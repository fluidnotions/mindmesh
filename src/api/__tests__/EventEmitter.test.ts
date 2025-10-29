import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotesAppEventEmitter } from '../EventEmitter';
import { NotesAppEvent } from '../types';

describe('NotesAppEventEmitter', () => {
  let emitter: NotesAppEventEmitter;

  beforeEach(() => {
    emitter = new NotesAppEventEmitter();
  });

  describe('on()', () => {
    it('should subscribe to an event', () => {
      const handler = vi.fn();
      emitter.on(NotesAppEvent.FILE_CREATED, handler);

      emitter.emit(NotesAppEvent.FILE_CREATED, {
        file: {
          id: '1',
          name: 'Test',
          content: '',
          path: '/Test',
          created: Date.now(),
          modified: Date.now(),
          links: [],
        },
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should return an unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = emitter.on(NotesAppEvent.FILE_CREATED, handler);

      unsubscribe();

      emitter.emit(NotesAppEvent.FILE_CREATED, {
        file: {
          id: '1',
          name: 'Test',
          content: '',
          path: '/Test',
          created: Date.now(),
          modified: Date.now(),
          links: [],
        },
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should allow multiple subscribers to the same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on(NotesAppEvent.FILE_CREATED, handler1);
      emitter.on(NotesAppEvent.FILE_CREATED, handler2);

      emitter.emit(NotesAppEvent.FILE_CREATED, {
        file: {
          id: '1',
          name: 'Test',
          content: '',
          path: '/Test',
          created: Date.now(),
          modified: Date.now(),
          links: [],
        },
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should pass the correct event data to handlers', () => {
      const handler = vi.fn();
      const eventData = {
        file: {
          id: 'test-id',
          name: 'Test File',
          content: 'content',
          path: '/Test File',
          created: 123456,
          modified: 789012,
          links: ['link1'],
        },
      };

      emitter.on(NotesAppEvent.FILE_CREATED, handler);
      emitter.emit(NotesAppEvent.FILE_CREATED, eventData);

      expect(handler).toHaveBeenCalledWith(eventData);
    });
  });

  describe('once()', () => {
    it('should only call handler once', () => {
      const handler = vi.fn();
      emitter.once(NotesAppEvent.FILE_CREATED, handler);

      const eventData = {
        file: {
          id: '1',
          name: 'Test',
          content: '',
          path: '/Test',
          created: Date.now(),
          modified: Date.now(),
          links: [],
        },
      };

      emitter.emit(NotesAppEvent.FILE_CREATED, eventData);
      emitter.emit(NotesAppEvent.FILE_CREATED, eventData);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should automatically unsubscribe after first call', () => {
      const handler = vi.fn();
      emitter.once(NotesAppEvent.FILE_CREATED, handler);

      expect(emitter.listenerCount(NotesAppEvent.FILE_CREATED)).toBe(1);

      emitter.emit(NotesAppEvent.FILE_CREATED, {
        file: {
          id: '1',
          name: 'Test',
          content: '',
          path: '/Test',
          created: Date.now(),
          modified: Date.now(),
          links: [],
        },
      });

      expect(emitter.listenerCount(NotesAppEvent.FILE_CREATED)).toBe(0);
    });
  });

  describe('off()', () => {
    it('should unsubscribe a specific handler', () => {
      const handler = vi.fn();
      emitter.on(NotesAppEvent.FILE_CREATED, handler);
      emitter.off(NotesAppEvent.FILE_CREATED, handler);

      emitter.emit(NotesAppEvent.FILE_CREATED, {
        file: {
          id: '1',
          name: 'Test',
          content: '',
          path: '/Test',
          created: Date.now(),
          modified: Date.now(),
          links: [],
        },
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should only unsubscribe the specified handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on(NotesAppEvent.FILE_CREATED, handler1);
      emitter.on(NotesAppEvent.FILE_CREATED, handler2);
      emitter.off(NotesAppEvent.FILE_CREATED, handler1);

      emitter.emit(NotesAppEvent.FILE_CREATED, {
        file: {
          id: '1',
          name: 'Test',
          content: '',
          path: '/Test',
          created: Date.now(),
          modified: Date.now(),
          links: [],
        },
      });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should handle unsubscribing a non-existent handler', () => {
      const handler = vi.fn();
      // Should not throw
      expect(() => {
        emitter.off(NotesAppEvent.FILE_CREATED, handler);
      }).not.toThrow();
    });
  });

  describe('emit()', () => {
    it('should emit events to all subscribed handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      emitter.on(NotesAppEvent.FILE_CREATED, handler1);
      emitter.on(NotesAppEvent.FILE_CREATED, handler2);
      emitter.on(NotesAppEvent.FILE_UPDATED, handler3);

      const fileCreatedData = {
        file: {
          id: '1',
          name: 'Test',
          content: '',
          path: '/Test',
          created: Date.now(),
          modified: Date.now(),
          links: [],
        },
      };

      emitter.emit(NotesAppEvent.FILE_CREATED, fileCreatedData);

      expect(handler1).toHaveBeenCalledWith(fileCreatedData);
      expect(handler2).toHaveBeenCalledWith(fileCreatedData);
      expect(handler3).not.toHaveBeenCalled();
    });

    it('should handle errors in handlers gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();

      emitter.on(NotesAppEvent.FILE_CREATED, errorHandler);
      emitter.on(NotesAppEvent.FILE_CREATED, normalHandler);

      emitter.emit(NotesAppEvent.FILE_CREATED, {
        file: {
          id: '1',
          name: 'Test',
          content: '',
          path: '/Test',
          created: Date.now(),
          modified: Date.now(),
          links: [],
        },
      });

      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should not fail when emitting to an event with no listeners', () => {
      expect(() => {
        emitter.emit(NotesAppEvent.FILE_CREATED, {
          file: {
            id: '1',
            name: 'Test',
            content: '',
            path: '/Test',
            created: Date.now(),
            modified: Date.now(),
            links: [],
          },
        });
      }).not.toThrow();
    });
  });

  describe('removeAllListeners()', () => {
    it('should remove all listeners for a specific event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      emitter.on(NotesAppEvent.FILE_CREATED, handler1);
      emitter.on(NotesAppEvent.FILE_CREATED, handler2);
      emitter.on(NotesAppEvent.FILE_UPDATED, handler3);

      emitter.removeAllListeners(NotesAppEvent.FILE_CREATED);

      emitter.emit(NotesAppEvent.FILE_CREATED, {
        file: {
          id: '1',
          name: 'Test',
          content: '',
          path: '/Test',
          created: Date.now(),
          modified: Date.now(),
          links: [],
        },
      });

      emitter.emit(NotesAppEvent.FILE_UPDATED, {
        file: {
          id: '1',
          name: 'Test',
          content: '',
          path: '/Test',
          created: Date.now(),
          modified: Date.now(),
          links: [],
        },
        previousContent: '',
      });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('should remove all listeners for all events when no event specified', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on(NotesAppEvent.FILE_CREATED, handler1);
      emitter.on(NotesAppEvent.FILE_UPDATED, handler2);

      emitter.removeAllListeners();

      emitter.emit(NotesAppEvent.FILE_CREATED, {
        file: {
          id: '1',
          name: 'Test',
          content: '',
          path: '/Test',
          created: Date.now(),
          modified: Date.now(),
          links: [],
        },
      });

      emitter.emit(NotesAppEvent.FILE_UPDATED, {
        file: {
          id: '1',
          name: 'Test',
          content: '',
          path: '/Test',
          created: Date.now(),
          modified: Date.now(),
          links: [],
        },
        previousContent: '',
      });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount()', () => {
    it('should return the correct number of listeners', () => {
      expect(emitter.listenerCount(NotesAppEvent.FILE_CREATED)).toBe(0);

      emitter.on(NotesAppEvent.FILE_CREATED, vi.fn());
      expect(emitter.listenerCount(NotesAppEvent.FILE_CREATED)).toBe(1);

      emitter.on(NotesAppEvent.FILE_CREATED, vi.fn());
      expect(emitter.listenerCount(NotesAppEvent.FILE_CREATED)).toBe(2);
    });

    it('should return 0 for events with no listeners', () => {
      expect(emitter.listenerCount(NotesAppEvent.FILE_DELETED)).toBe(0);
    });
  });

  describe('hasListeners()', () => {
    it('should return true when listeners exist', () => {
      emitter.on(NotesAppEvent.FILE_CREATED, vi.fn());
      expect(emitter.hasListeners(NotesAppEvent.FILE_CREATED)).toBe(true);
    });

    it('should return false when no listeners exist', () => {
      expect(emitter.hasListeners(NotesAppEvent.FILE_CREATED)).toBe(false);
    });

    it('should return false after all listeners are removed', () => {
      emitter.on(NotesAppEvent.FILE_CREATED, vi.fn());
      emitter.removeAllListeners(NotesAppEvent.FILE_CREATED);
      expect(emitter.hasListeners(NotesAppEvent.FILE_CREATED)).toBe(false);
    });
  });

  describe('Type safety', () => {
    it('should enforce type-safe event handlers', () => {
      // This test validates that TypeScript compilation succeeds
      emitter.on(NotesAppEvent.FILE_CREATED, (event) => {
        // event should be typed as FileCreatedEvent
        expect(event.file).toBeDefined();
        expect(event.file.id).toBeDefined();
      });

      emitter.on(NotesAppEvent.FILE_UPDATED, (event) => {
        // event should be typed as FileUpdatedEvent
        expect(event.file).toBeDefined();
        expect(event.previousContent).toBeDefined();
      });

      emitter.on(NotesAppEvent.WORKSPACE_LOADED, (event) => {
        // event should be typed as WorkspaceLoadedEvent
        expect(event.fileCount).toBeDefined();
        expect(event.folderCount).toBeDefined();
      });
    });
  });
});
