/**
 * In-process publish/subscribe for live updates (server-sent events). Events
 * are published only after the database transaction that produced them has
 * committed. Single-process by design; see README_DEPLOY.md for scaling.
 */
export interface LiveEvent {
  type: 'order.updated' | 'conversation.updated' | 'message.created' | 'notification.created';
  data: Record<string, unknown>;
}

/** Audience: a specific user, or every signed-in staff member. */
export type Audience = { userId: string } | { staff: true };

type Listener = (e: LiveEvent) => void;

export class EventBus {
  private users = new Map<string, Set<Listener>>();
  private staff = new Set<Listener>();

  subscribe(userId: string, isStaff: boolean, listener: Listener): () => void {
    let set = this.users.get(userId);
    if (!set) this.users.set(userId, (set = new Set()));
    set.add(listener);
    if (isStaff) this.staff.add(listener);
    return () => {
      set.delete(listener);
      if (!set.size) this.users.delete(userId);
      this.staff.delete(listener);
    };
  }

  publish(audiences: Audience[], event: LiveEvent): void {
    const delivered = new Set<Listener>();
    for (const a of audiences) {
      const targets = 'staff' in a ? this.staff : (this.users.get(a.userId) ?? new Set<Listener>());
      for (const l of targets) {
        if (delivered.has(l)) continue;
        delivered.add(l);
        try {
          l(event);
        } catch {
          /* a broken connection must not affect others */
        }
      }
    }
  }

  get connectionCount(): number {
    let n = 0;
    for (const s of this.users.values()) n += s.size;
    return n;
  }
}
