import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { createActivityJournal } from "@/lib/automation-policy";

const schema=z.object({repositoryFullName:z.string().regex(/^[^/\s]+\/[^/\s]+$/).max(200),localDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),localTime:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)}).strict();

export async function POST(request:Request){
  const account=await getChatGPTUser();if(!account)return Response.json({error:"Sign in to preview the activity journal."},{status:401});
  const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:"Preview values are invalid."},{status:400});
  const path=`.commitkeep/log/${parsed.data.localDate.slice(0,7)}.md`;
  const content=createActivityJournal("",{full_name:parsed.data.repositoryFullName,default_branch:"default branch",pushed_at:"Read at execution time",open_issues_count:0,visibility:"authorized repository"},parsed.data.localDate,parsed.data.localTime,"preview");
  return Response.json({path,content,notice:"This disclosed entry records a scheduled Commit-Keep check. It does not claim source-code work or guarantee a GitHub contribution."});
}
