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

// Count queries use the same private families as their pages, with no actor/project/notification collision.
test("pending count keys retain principal isolation and prefix invalidation", async () => {
 const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
 let finish!: (value: number) => void;
 const late = new Promise<number>(resolve => { finish = resolve; });
 const old = client.fetchQuery({ queryKey: invitationKeys.incomingPending("B"), queryFn: () => late }).catch(() => undefined);
 client.setQueryData(invitationKeys.projectPending("P", "B"), 2);
 client.setQueryData(invitationKeys.projectPending("Q", "B"), 7);
 await client.invalidateQueries({ queryKey: invitationKeys.project("P", "B") });
 expect(client.getQueryState(invitationKeys.projectPending("P", "B"))?.isInvalidated).toBe(true);
 expect(client.getQueryState(invitationKeys.projectPending("Q", "B"))?.isInvalidated).toBe(false);
 clearPrivateInvitations(client);
 client.setQueryData(invitationKeys.incomingPending("C"), 0);
 client.setQueryData(invitationKeys.projectPending("P", "C"), 1);
 finish(99); await old;
 expect(client.getQueryData(invitationKeys.incomingPending("B"))).toBeUndefined();
 expect(client.getQueryData(invitationKeys.projectPending("P", "B"))).toBeUndefined();
 expect(client.getQueryData(invitationKeys.incomingPending("C"))).toBe(0);
 expect(client.getQueryData(invitationKeys.projectPending("P", "C"))).toBe(1);
 await client.invalidateQueries({ queryKey: invitationKeys.mineRoot("C") });
 expect(client.getQueryState(invitationKeys.incomingPending("C"))?.isInvalidated).toBe(true);
 expect(client.getQueryState(invitationKeys.projectPending("P", "C"))?.isInvalidated).toBe(false);
 client.clear();
});
