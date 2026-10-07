import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
vi.mock("server-only", () => ({}));
import { ImageAdmissionError, resourceError, withImageLease } from "@/lib/stories/resources";
const rpc=vi.fn(), work=vi.fn();
const client={rpc} as unknown as SupabaseClient<Database>;
beforeEach(()=>{vi.resetAllMocks(); rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:"unpredictable-lease",error:null})});work.mockResolvedValue("pixels");});
describe("image work admission",()=>{
  it.each(["PT429","PT503"])("does not decode when %s admission fails",async code=>{
    rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:null,error:{code,message:"private diagnostic"}})});
    await expect(withImageLease(client,"story",work)).rejects.toBeInstanceOf(ImageAdmissionError);
    expect(work).not.toHaveBeenCalled();expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("releases after a successful decode",async()=>{
    expect(await withImageLease(client,"story",work)).toBe("pixels");
    expect(rpc).toHaveBeenLastCalledWith("release_image_processing",{p_lease_id:"unpredictable-lease"});
  });
  it("releases even after decoder failure",async()=>{
    work.mockRejectedValue(new Error("decode"));await expect(withImageLease(client,"story",work)).rejects.toThrow("decode");expect(rpc).toHaveBeenCalledTimes(2);
  });
  it("does not retry work after an uncertain release",async()=>{
    rpc.mockReturnValueOnce({abortSignal:()=>Promise.resolve({data:"lease",error:null})}).mockImplementationOnce(()=>{throw new Error("network private detail");});
    expect(await withImageLease(client,"story",work)).toBe("pixels");expect(work).toHaveBeenCalledOnce();
  });
  it("maps only public resource codes without disclosing private diagnostics",()=>{
    expect(resourceError({code:"PT429"})).toContain("limit");expect(resourceError({code:"PT503"})).toContain("paused");expect(resourceError({code:"private error"})).toBeUndefined();
  });
});
