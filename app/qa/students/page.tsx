import { redirect } from "next/navigation";

export default function StudentQuestionsRedirect() {
  redirect("/dashboard#qa");
}
