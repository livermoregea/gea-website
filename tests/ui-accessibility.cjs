// Static regression guard for first-party controls, including authenticated staff forms.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function files(directory) {
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):[path.join(directory,entry.name)]).filter(file=>file.endsWith('.tsx'));
}
test('Every first-party form control has a label association or explicit accessible name', () => {
  const missing=[];
  for(const file of [...files('app'),...files('components')]){
    const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const attributes=node=>Object.fromEntries((node.attributes?.properties??[]).filter(ts.isJsxAttribute).map(attribute=>[attribute.name.getText(source),attribute.initializer?.getText(source)]));
    const labels=new Set();
    function collect(node){if((ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))&&node.tagName.getText(source)==='label'){const id=attributes(node).htmlFor;if(id)labels.add(id);}ts.forEachChild(node,collect);}
    collect(source);
    function inspect(node){
      if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
        const tag=node.tagName.getText(source),attrs=attributes(node);
        if(['input','select','textarea'].includes(tag)&&attrs.type!=='"hidden"'){
          let wrapped=false,parent=node.parent;
          while(parent){if(ts.isJsxElement(parent)&&parent.openingElement.tagName.getText(source)==='label'){wrapped=true;break;}parent=parent.parent;}
          if(!wrapped&&!attrs['aria-label']&&!attrs['aria-labelledby']&&!(attrs.id&&labels.has(attrs.id))){missing.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line+1} ${tag}`);}
        }
      }
      ts.forEachChild(node,inspect);
    }
    inspect(source);
  }
  assert.deepEqual(missing,[],`Controls need accessible names:\n${missing.join('\n')}`);
});
