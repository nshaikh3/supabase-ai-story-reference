import { describe, expect, it, vi } from "vitest";
import { applyCleanup, digest, eligibleObject, rotateWorker, validateCleanupReport } from "../scripts/operations-core.mjs";
const path="11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/12345678-1234-4234-8234-123456789004.webp";
const row={bucket_id:"story-assets",id:"12345678-1234-4234-8234-123456789005",name:path,owner_id:path.split("/")[0],version:"one",created_at:new Date(Date.now()-172800000).toISOString(),attached:false,active:false};
const plan=()=>({schemaVersion:1,target:"supabase-ai-story-reference",createdAt:new Date().toISOString(),candidates:[row]});
describe("reviewable Storage cleanup",()=>{
  it.each([{bucket_id:"other"},{name:"../escape"},{owner_id:"other"},{created_at:new Date().toISOString()},{attached:true},{active:true},{id:"bad"},{version:{} }])("excludes unsafe candidate %j",override=>expect(eligibleObject({...row,...override})).toBe(false));
  it("requires digest, exact target, age and no duplicate entries",()=>{
    const bytes=JSON.stringify(plan());expect(validateCleanupReport(bytes,digest(bytes),plan().target).candidates).toHaveLength(1);
    expect(()=>validateCleanupReport(bytes,"0".repeat(64),plan().target)).toThrow("digest");
    expect(()=>validateCleanupReport(bytes,digest(bytes),"production")).toThrow();
    const duplicate=JSON.stringify({...plan(),candidates:[row,row]});expect(()=>validateCleanupReport(duplicate,digest(duplicate),plan().target)).toThrow();
    const stale=JSON.stringify({...plan(),createdAt:new Date(Date.now()-7200000).toISOString()});expect(()=>validateCleanupReport(stale,digest(stale),plan().target)).toThrow();
  });
  it("never removes a path when the atomic retirement claim loses to a reservation",async()=>{
    const transport={claim:vi.fn().mockResolvedValue(false),inspect:vi.fn(),remove:vi.fn()};
    expect(await applyCleanup(plan(),transport)).toEqual({removed:0,skipped:1});expect(transport.inspect).not.toHaveBeenCalled();expect(transport.remove).not.toHaveBeenCalled();
  });
  it.each([{version:"replaced"},{id:"12345678-1234-4234-8234-123456789099"},{attached:true},{active:true}])("skips identity/ownership changes after report %j",async override=>{
    const transport={claim:vi.fn().mockResolvedValue(true),inspect:vi.fn().mockResolvedValue({...row,...override}),remove:vi.fn()};
    expect(await applyCleanup(plan(),transport)).toEqual({removed:0,skipped:1});expect(transport.remove).not.toHaveBeenCalled();
  });
  it("removes only an eligible rechecked path through the API adapter",async()=>{
    const transport={claim:vi.fn().mockResolvedValue(true),inspect:vi.fn().mockResolvedValue(row),remove:vi.fn()};
    expect(await applyCleanup(plan(),transport)).toEqual({removed:1,skipped:0});expect(transport.remove).toHaveBeenCalledWith(path);
  });
  it("stops on a partial or ambiguous API failure",async()=>{
    const transport={claim:vi.fn().mockResolvedValue(true),inspect:vi.fn().mockResolvedValue(row),remove:vi.fn().mockRejectedValue(new Error("unavailable"))};
    await expect(applyCleanup(plan(),transport)).rejects.toThrow("unavailable");
  });
});
describe("worker rotation",()=>{
  it("pauses, drains, replaces, verifies and only then restores admission",async()=>{
    const order:string[]=[];
    const transport=Object.fromEntries(["pause","drain","writeSecret","restart","provision","verify","restore","finish"].map(name=>[name,vi.fn(async()=>{order.push(name);return true;})]));
    await rotateWorker(transport);expect(order).toEqual(Object.keys(transport));expect(transport.restore).toHaveBeenCalledWith(true);
  });
  it.each(["drain","writeSecret","restart","provision","verify"])("leaves generation paused after %s fails",async stage=>{
    const transport=Object.fromEntries(["pause","drain","writeSecret","restart","provision","verify","restore","finish"].map(name=>[name,vi.fn().mockResolvedValue(true)]));
    transport[stage].mockRejectedValue(new Error("failure"));await expect(rotateWorker(transport)).rejects.toThrow();expect(transport.restore).not.toHaveBeenCalled();expect(transport.finish).not.toHaveBeenCalled();
  });
});
