import {test,expect} from "@playwright/test";
import {QueryClient} from "@tanstack/react-query";
import {invitationKeys,clearPrivateInvitations} from "../src/features/invitations/query-keys";

test("private invitation cache cancellation cannot repopulate another principal after late completion",async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 let resolve!:(value:string)=>void;const pending=new Promise<string>(r=>resolve=r);
 const old=client.fetchQuery({queryKey:invitationKeys.mine("B","PENDING",0),queryFn:()=>pending}).catch(()=>undefined);
 client.setQueryData(invitationKeys.preview("B","same-id"),{name:"B private"});
 client.setQueryData([...invitationKeys.project("project","B"),"PENDING",0],["B manager history"]);
 clearPrivateInvitations(client);
 client.setQueryData(invitationKeys.mine("C","PENDING",0),[]);
 resolve("late B private");await old;
 expect(client.getQueryData(invitationKeys.mine("C","PENDING",0))).toEqual([]);
 expect(client.getQueryData(invitationKeys.mine("B","PENDING",0))).toBeUndefined();
 expect(client.getQueryData(invitationKeys.preview("C","same-id"))).toBeUndefined();
 expect(client.getQueryData([...invitationKeys.project("project","B"),"PENDING",0])).toBeUndefined();
 expect(client.getQueriesData({queryKey:invitationKeys.root})).toHaveLength(1);
 client.clear();
});
