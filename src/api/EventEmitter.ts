// Event emitter for NotesApp events

import { NotesAppEvent, NotesAppEventMap, EventHandler } from './types';

/**
 * Type-safe event emitter for NotesApp events
 */
export class NotesAppEventEmitter {
  private listeners: Map<NotesAppEvent, Set<EventHandler>> = new Map();

  /**
   * Subscribe to an event
   */
  on<E extends NotesAppEvent>(
    event: E,
    handler: EventHandler<NotesAppEventMap[E]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Subscribe to an event once (auto-unsubscribes after first call)
   */
  once<E extends NotesAppEvent>(
    event: E,
    handler: EventHandler<NotesAppEventMap[E]>
  ): void {
    const wrappedHandler = (data: NotesAppEventMap[E]) => {
      handler(data);
      this.off(event, wrappedHandler);
    };

    this.on(event, wrappedHandler);
  }

  /**
   * Unsubscribe from an event
   */
  off<E extends NotesAppEvent>(
    event: E,
    handler: EventHandler<NotesAppEventMap[E]>
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit an event to all subscribers
   */
  emit<E extends NotesAppEvent>(event: E, data: NotesAppEventMap[E]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for a specific event or all events
   */
  removeAllListeners(event?: NotesAppEvent): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount(event: NotesAppEvent): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Check if there are any listeners for an event
   */
  hasListeners(event: NotesAppEvent): boolean {
    return this.listenerCount(event) > 0;
  }
}
