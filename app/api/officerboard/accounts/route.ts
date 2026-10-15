import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import { validAccountEmail, type ManagedAccount } from '@/lib/account-management';

const noStore = { 'Cache-Control': 'private, no-store' };
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: noStore }); }
async function authorize() {
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { response: json({error:'Account management requires Supabase and its server service key.'},503) };
  const session = await createClient();
  const {data:{user},error} = await session.auth.getUser();
  if (error || !user) return {response:json({error:'Sign in to GEA One to manage accounts.'},401)};
  const {data:root,error:roleError} = await session.from('super_admins').select('auth_user_id').eq('auth_user_id',user.id).maybeSingle();
  if (roleError) return {response:json({error:'Super-admin database setup is required.'},503)};
  if (!root) return {response:json({error:'Super-admin access is required.'},403)};
  return {user,admin:createAdminClient()};
}
async function authUsers(admin: ReturnType<typeof createAdminClient>) {
  const users: {id:string;email?:string;user_metadata?:Record<string,unknown>}[]=[];
  for(let page=1;;page++){
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});
    if(error) throw new Error('Could not load accounts.');
    users.push(...data.users);
    if(data.users.length<1000) return users;
  }
}
async function rows(admin:ReturnType<typeof createAdminClient>,table:string,columns:string){
  const values:Record<string,any>[]=[];
  for(let from=0;;from+=100){
    const {data,error}=await admin.from(table).select(columns).order('id').range(from,from+99);
    if(error) throw new Error('Could not load profiles.');
    values.push(...(data??[]));
    if((data?.length??0)<100)return values;
  }
}
export async function GET(){
  try{
    const access=await authorize();if(access.response)return access.response;
    const admin=access.admin!;
    const [users,students,teachers,officers]=await Promise.all([
      authUsers(admin),rows(admin,'student_profiles','id,auth_user_id,full_name,auth_email,school_email,display_username,graduating_class_year'),
      rows(admin,'teacher_profiles','id,auth_user_id,full_name,auth_email,school_email'),
      rows(admin,'officer_profiles','id,name,role,position,reviewer_kind,access_enabled'),
    ]);
    const emailFor=(id:string)=>users.find(user=>user.id===id)?.email??'';
    const accounts:ManagedAccount[]=[
      ...students.map(row=>({userId:row.auth_user_id,email:emailFor(row.auth_user_id)||row.auth_email,name:row.full_name,kind:'student' as const,username:row.display_username,classYear:row.graduating_class_year})),
      ...teachers.map(row=>({userId:row.auth_user_id,email:emailFor(row.auth_user_id)||row.auth_email,name:row.full_name,kind:'teacher' as const})),
      ...officers.map(row=>({userId:row.id,email:emailFor(row.id),name:row.name,kind:'officer' as const,portalRole:row.role,reviewerKind:row.reviewer_kind,position:row.position,portalEnabled:row.access_enabled})),
    ];
    return json({accounts,authAccounts:users.map(user=>({id:user.id,email:user.email??'',name:typeof user.user_metadata?.full_name==='string'?user.user_metadata.full_name:''}))});
  }catch{return json({error:'Could not load accounts. Try again.'},500);}
}
function text(body:Record<string,unknown>,key:string,max:number){
  const value=body[key];return typeof value==='string'&&value.trim().length<=max?value.trim():'';
}
function accountError(error:{code?:string;message?:string}){
  if(error.code==='P0001')return error.message??'Account could not be saved.';
  if(error.code==='23505')return 'That email, username, or student ID is already in use.';
  if(['42P01','42883','42703','PGRST202','PGRST204','PGRST205'].includes(error.code??''))return 'Apply the super-admin database migration before managing accounts.';
  return 'Account changes could not be saved. Check the details and try again.';
}
export async function POST(request:Request){
  // Role-management requests must originate from the same website as the session.
  const origin=request.headers.get('origin');
  if(!origin||origin!==new URL(request.url).origin)return json({error:'Request origin is not allowed.'},403);
  try{
    const access=await authorize();if(access.response)return access.response;
    const raw=await request.text();if(raw.length>20000)return json({error:'Request is too large.'},413);
    let body:Record<string,unknown>;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
    if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Invalid request.'},400);
    const kind=text(body,'kind',16),action=text(body,'action',16),userId=text(body,'userId',64);
    if(!['student','teacher','officer'].includes(kind)||!['save','remove'].includes(action))return json({error:'Choose a supported account action.'},400);
    const admin=access.admin!;
    if(action==='remove'){
      const reason=text(body,'reason',2000);
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)||reason.length<10||kind==='officer'||body.confirmed!==true)return json({error:'Confirm the student or teacher removal and give a reason of at least 10 characters.'},400);
      if(userId===access.user!.id)return json({error:'You cannot remove your own access here.'},400);
      const {error}=await admin.rpc('superadmin_remove_account',{p_actor:access.user!.id,p_target:userId,p_kind:kind,p_reason:reason});
      return error?json({error:accountError(error)},400):json({ok:true,message:kind==='teacher'?'Teacher access and automatic super-admin permissions removed. The GEA One account and independently granted permissions remain.':'Student access removed. The GEA One account and any separate permissions remain.'});
    }
    const name=text(body,'name',160),email=text(body,'email',254).toLowerCase(),username=text(body,'username',80),studentId=text(body,'studentId',64),classYear=Number(body.classYear);
    const portalRole=text(body,'portalRole',16)||'officer',reviewerKind=text(body,'reviewerKind',16)||null,position=text(body,'position',160);
    const password=typeof body.password==='string'?body.password:'';
    if(!name||!validAccountEmail(email))return json({error:'Enter a name and valid @lvjusd.org email.'},400);
    if(kind==='student'&&(!username||!Number.isInteger(classYear)||classYear<2020||classYear>2100))return json({error:'Enter a username and valid graduating class year.'},400);
    if(kind==='officer'&&(!['officer','admin'].includes(portalRole)||(portalRole==='admin'&&!['president','advisor'].includes(reviewerKind??''))||(portalRole==='officer'&&reviewerKind)))return json({error:'Choose a valid officer or reviewer role.'},400);
    const users=await authUsers(admin);
    let target=userId?users.find(user=>user.id===userId):users.find(user=>user.email?.toLowerCase()===email);
    if(userId&&!target)return json({error:'Existing account not found.'},404);
    if(users.some(user=>user.email?.toLowerCase()===email&&user.id!==target?.id))return json({error:'That email belongs to another account.'},409);
    // A student ID is mandatory when attaching a new student profile.
    if(kind==='student'&&!studentId){
      if(!target)return json({error:'Enter a student ID for the new student.'},400);
      const {data:existing,error}=await admin.from('student_profiles').select('id').eq('auth_user_id',target.id).maybeSingle();
      if(error||!existing)return json({error:'Enter a student ID when adding student access.'},400);
    }
    if(!target&&(password.length<12||password.length>128))return json({error:'Enter an initial password of 12–128 characters for a new GEA One account.'},400);
    let created=false,changedEmail=false;const oldEmail=target?.email;
    if(!target){
      const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});
      if(error||!data.user)return json({error:'Could not create the GEA One account. Check the email and password.'},400);
      target=data.user;created=true;
    }else if(oldEmail?.toLowerCase()!==email){
      const {error}=await admin.auth.admin.updateUserById(target.id,{email,email_confirm:true});
      if(error)return json({error:'Could not update the GEA One email.'},400);
      changedEmail=true;
    }
    let error: {code?:string;message?:string}|null=null;
    try { const result=await admin.rpc('superadmin_save_account',{
      p_actor:access.user!.id,p_target:target!.id,p_kind:kind,p_name:name,p_email:email,
      p_username:username||null,p_class_year:kind==='student'?classYear:null,p_student_id:studentId||null,
      p_portal_role:portalRole,p_reviewer_kind:reviewerKind,p_position:position,
    }); error=result.error; } catch { error={message:'Could not save profile access.'}; }
    if(error){
      let recoveryError=false;
      if(created){const cleanup=await admin.auth.admin.deleteUser(target!.id);recoveryError=Boolean(cleanup.error);}
      else if(changedEmail&&oldEmail){const restore=await admin.auth.admin.updateUserById(target!.id,{email:oldEmail,email_confirm:true});recoveryError=Boolean(restore.error);}
      return json({error:accountError(error)+(recoveryError?' The login change could not be rolled back; review this account in Supabase Authentication before retrying.':'')},400);
    }
    return json({ok:true,message:created?'GEA One account created. Share the initial password with its owner.':'GEA One access saved. The existing password was preserved.'});
  }catch{return json({error:'Could not save account changes. Check your connection and try again.'},500);}
}
