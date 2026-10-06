import type { InvitePlan, InviteGuest, InviteEvent } from "@/lib/invite/server";
import type { InviteShareToken } from "@/lib/invite/shareTokens";

export function planFixture(): InvitePlan {
  return { id: "plan-1", planId: "plan-1", ownerUid: "owner-1", name: "CI plan", yearMonth: "2026-10",
    passwordHash: null, publicToken: "public-1", isActive: true };
}
export function shareFixture(): InviteShareToken {
  return { id: "ABC234", token: "ABC234", inviteCode: "ABC234", publicToken: "public-1", planId: "plan-1",
    ownerUid: "owner-1", eventIds: ["event-1"], participantId: null, expiresAt: null, status: "active",
    isActive: true, createdAt: null, updatedAt: null, revokedAt: null, revokedReason: null };
}
export function guestFixture(): InviteGuest {
  return { id: "guest-1", guestId: "guest-1", planId: "plan-1", ownerUid: "owner-1", nickname: "CI Guest",
    nicknameKey: "ci guest", pinHash: "" };
}
export function eventFixture(): InviteEvent {
  return { id: "event-1", eventId: "event-1", planId: "plan-1", ownerUid: "owner-1", name: "CI event",
    eventDate: "2026-10-20", timeSlot: "AM", timeDetail: "09:00", place: "CI room", status: "accepting",
    sortOrder: 0, isActive: true };
}
