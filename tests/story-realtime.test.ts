import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
import { isStoryNotification, watchStory } from "../src/lib/stories/realtime";

const storyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const userId = "11111111-1111-4111-8111-111111111111";
const payload = { id: "33333333-3333-4333-8333-333333333333", story_id: storyId, job_id: "44444444-4444-4444-8444-444444444444", status: "complete" };
const session = { access_token: "synthetic-token", user: { id: userId } } as Session;

function fixture() {
  let authEvent: (event: string, value: Session | null) => void = () => {};
  const channels: { notify: (value: { payload: unknown }) => void; status: (value: string) => void; on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> }[] = [];
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      onAuthStateChange: vi.fn(callback => { authEvent = callback; return { data: { subscription: { unsubscribe } } }; }),
    },
    realtime: { setAuth: vi.fn().mockResolvedValue(undefined) },
    channel: vi.fn(() => {
      const channel = {
        notify: (_value: { payload: unknown }) => { void _value; }, status: (_value: string) => { void _value; },
        on: vi.fn((_type, _filter, callback) => { channel.notify = callback; return channel; }),
        subscribe: vi.fn(callback => { channel.status = callback; return channel; }),
      };
      channels.push(channel); return channel;
    }),
    removeChannel: vi.fn().mockResolvedValue("ok"),
  };
  const unsubscribe = vi.fn(), refresh = vi.fn(), connection = vi.fn(), identityChanged = vi.fn();
  const watcher = watchStory({ client: client as unknown as SupabaseClient<Database>, storyId, userId, refresh, connection, identityChanged });
  return { client, channels, watcher, refresh, connection, identityChanged, unsubscribe, authEvent: (value: Session | null, event = "SIGNED_IN") => authEvent(event, value) };
}

describe("private story subscription lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("authenticates before joining the exact private topic", async () => {
    const f = fixture(); await vi.advanceTimersByTimeAsync(0);
    expect(f.client.realtime.setAuth).toHaveBeenCalledWith(session.access_token);
    expect(f.client.channel).toHaveBeenCalledWith(`story:${storyId}`, { config: { private: true } });
    expect(f.channels[0].on).toHaveBeenCalledWith("broadcast", { event: "generation_status" }, expect.any(Function));
    f.watcher.stop();
  });
  it("reconciles after the first join and every reconnect without periodic polling", async () => {
    const f = fixture(); await vi.advanceTimersByTimeAsync(0);
    f.channels[0].status("SUBSCRIBED"); await vi.advanceTimersByTimeAsync(100);
    expect(f.refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000); expect(f.refresh).toHaveBeenCalledTimes(1);
    f.channels[0].status("CHANNEL_ERROR"); expect(f.connection).toHaveBeenLastCalledWith("disconnected");
    f.channels[0].status("SUBSCRIBED"); await vi.advanceTimersByTimeAsync(100);
    expect(f.refresh).toHaveBeenCalledTimes(2); f.watcher.stop();
  });
  it("coalesces duplicate or out-of-order notifications into authoritative refreshes", async () => {
    const f = fixture(); await vi.advanceTimersByTimeAsync(0);
    for (const status of ["complete", "generating", "complete"]) f.channels[0].notify({ payload: { ...payload, status } });
    await vi.advanceTimersByTimeAsync(100); expect(f.refresh).toHaveBeenCalledTimes(1); f.watcher.stop();
  });
  it("ignores malformed and unrelated payloads", async () => {
    const f = fixture(); await vi.advanceTimersByTimeAsync(0);
    for (const value of [null, {}, { ...payload, story_id: "other" }, { ...payload, prompt: "unwanted" }, { ...payload, status: "invented" }]) f.channels[0].notify({ payload: value });
    await vi.advanceTimersByTimeAsync(100); expect(f.refresh).not.toHaveBeenCalled(); f.watcher.stop();
  });
  it("cancels pending refreshes, auth callbacks and late socket events on teardown", async () => {
    const f = fixture(); await vi.advanceTimersByTimeAsync(0);
    f.channels[0].notify({ payload }); f.authEvent(session); f.watcher.stop();
    f.channels[0].status("SUBSCRIBED"); f.channels[0].notify({ payload });
    await vi.advanceTimersByTimeAsync(100);
    expect(f.refresh).not.toHaveBeenCalled(); expect(f.unsubscribe).toHaveBeenCalledOnce(); expect(f.client.removeChannel).toHaveBeenCalledOnce();
  });
  it.each([null, { ...session, user: { ...session.user, id: "other-user" } }])("tears down when identity changes: %j", async value => {
    const f = fixture(); await vi.advanceTimersByTimeAsync(0);
    f.authEvent(value, value ? "SIGNED_IN" : "SIGNED_OUT"); await vi.advanceTimersByTimeAsync(0);
    expect(f.identityChanged).toHaveBeenCalledOnce(); expect(f.client.removeChannel).toHaveBeenCalledOnce();
    await f.watcher.resume(); expect(f.client.channel).toHaveBeenCalledOnce();
  });
  it("updates token authorization and reconciles without making a duplicate channel", async () => {
    const f = fixture(); await vi.advanceTimersByTimeAsync(0);
    f.authEvent({ ...session, access_token: "refreshed-token" }, "TOKEN_REFRESHED"); await vi.advanceTimersByTimeAsync(100);
    expect(f.client.realtime.setAuth).toHaveBeenLastCalledWith("refreshed-token"); expect(f.client.channel).toHaveBeenCalledOnce(); expect(f.refresh).toHaveBeenCalledOnce(); f.watcher.stop();
  });
  it("removes the offline channel and reauthorizes on resume", async () => {
    const f = fixture(); await vi.advanceTimersByTimeAsync(0);
    f.watcher.pause(); expect(f.client.removeChannel).toHaveBeenCalledOnce();
    f.channels[0].notify({ payload }); await vi.advanceTimersByTimeAsync(100); expect(f.refresh).not.toHaveBeenCalled();
    await f.watcher.resume(); expect(f.client.channel).toHaveBeenCalledTimes(2);
    f.channels[1].status("SUBSCRIBED"); await vi.advanceTimersByTimeAsync(100); expect(f.refresh).toHaveBeenCalledOnce(); f.watcher.stop();
  });
  it("checks cookie session changes on visibility/online resume", async () => {
    const f = fixture(); await vi.advanceTimersByTimeAsync(0);
    f.client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await f.watcher.resume(); expect(f.identityChanged).toHaveBeenCalledOnce(); expect(f.client.removeChannel).toHaveBeenCalledOnce();
  });
  it("does not subscribe after unmount while authentication is pending", async () => {
    const f = fixture(); f.watcher.stop(); await vi.advanceTimersByTimeAsync(100);
    expect(f.client.channel).not.toHaveBeenCalled(); expect(f.refresh).not.toHaveBeenCalled();
  });
  it("shows a safe disconnected state on auth transport failure", async () => {
    const f = fixture(); await vi.advanceTimersByTimeAsync(0);
    f.client.auth.getSession.mockRejectedValue(new Error("sensitive diagnostic"));
    await f.watcher.resume(); expect(f.connection).toHaveBeenLastCalledWith("disconnected"); expect(f.identityChanged).not.toHaveBeenCalled(); f.watcher.stop();
  });
});

describe("notification envelope", () => {
  it("accepts the pinned realtime.send envelope", () => expect(isStoryNotification(payload, storyId)).toBe(true));
  it.each([null, [], "text", { ...payload, id: "invalid" }, { ...payload, job_id: "invalid" }, { ...payload, status: 1 }, { ...payload, story_id: "other" }])("rejects untrusted data %j", value => expect(isStoryNotification(value, storyId)).toBe(false));
});
