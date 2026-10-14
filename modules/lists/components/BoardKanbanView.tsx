'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  CollisionDetection,
  UniqueIdentifier,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import type { ListDTO, ListPermissionsDTO } from '../types';
import type { CardDTO, CardPermissionsDTO } from '@/modules/cards';
import { BoardColumn } from './BoardColumn';
import { CreateListForm } from './CreateListForm';
import {
  createListAction,
  updateListAction,
  deleteListAction,
  reorderListsAction,
} from '../actions';
import {
  createCardAction,
  updateCardAction,
  deleteCardAction,
  moveCardAction,
  useRealtimeCards,
  KanbanCard,
  CardDetailModal,
  UpdateCardInput,
} from '@/modules/cards';
import { getCurrentChatUserAction } from '@/modules/chat/actions';
import { useRealtimeLists } from '../hooks/useRealtimeLists';
import { Layers } from 'lucide-react';

interface BoardKanbanViewProps {
  boardId: number;
  initialLists: ListDTO[];
  permissions: ListPermissionsDTO;
  initialCards?: CardDTO[];
  cardPermissions?: CardPermissionsDTO;
  currentUser?: {
    id: number;
    name?: string;
    username: string;
  };
}

/**
 * Strict binary string comparison matching Rocicorp Base62 fractional-indexing
 * and MySQL utf8mb4_bin collation. Never use localeCompare here.
 */
function compareCards(a: CardDTO, b: CardDTO): number {
  if (a.rank < b.rank) return -1;
  if (a.rank > b.rank) return 1;
  return a.id - b.id;
}

function groupCardsByList(
  lists: ListDTO[],
  cards: CardDTO[]
): Record<number, CardDTO[]> {
  const sorted = [...cards].sort(compareCards);
  const result: Record<number, CardDTO[]> = {};
  for (const list of lists) {
    result[list.id] = [];
  }
  for (const card of sorted) {
    if (!result[card.listId]) {
      result[card.listId] = [];
    }
    result[card.listId].push(card);
  }
  return result;
}

export function BoardKanbanView({
  boardId,
  initialLists,
  permissions,
  initialCards = [],
  cardPermissions = { canCreate: true, canUpdate: true, canDelete: true },
  currentUser,
}: BoardKanbanViewProps) {
  const [lists, setLists] = useState<ListDTO[]>(initialLists);
  const [items, setItems] = useState<Record<number, CardDTO[]>>(() =>
    groupCardsByList(initialLists, initialCards)
  );

  // Selected Card for Detail Modal (65% content / 35% comments)
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [currentChatUser, setCurrentChatUser] = useState<{
    id: number;
    name?: string;
    username: string;
  } | null>(
    currentUser
      ? { id: currentUser.id, name: currentUser.name, username: currentUser.username }
      : null
  );

  useEffect(() => {
    if (!currentChatUser) {
      getCurrentChatUserAction().then((res) => {
        if (res.success && res.data) {
          setCurrentChatUser({ id: res.data.userId, username: res.data.username });
        }
      });
    }
  }, [currentChatUser]);

  const selectedCard = useMemo(() => {
    if (!selectedCardId) return null;
    for (const listCards of Object.values(items)) {
      const found = listCards.find((c) => c.id === selectedCardId);
      if (found) return found;
    }
    return null;
  }, [items, selectedCardId]);

  // Synchronous refs to prevent stale state closures during rapid drag events
  const itemsRef = useRef<Record<number, CardDTO[]>>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Snapshot of items before a drag starts for cancel / failure rollbacks
  const clonedItems = useRef<Record<number, CardDTO[]> | null>(null);

  // Layout stability tracking for Clauderic multi-container collision strategy
  const recentlyMovedToNewContainer = useRef<boolean>(false);
  const lastOverId = useRef<UniqueIdentifier | null>(null);

  // Active dragged items
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [activeCard, setActiveCard] = useState<CardDTO | null>(null);

  // Reset recentlyMovedToNewContainer flag after layout render completes
  useEffect(() => {
    requestAnimationFrame(() => {
      recentlyMovedToNewContainer.current = false;
    });
  }, [items]);

  // Setup accessible dnd-kit sensors:
  // - MouseSensor: 5px movement constraint so clicks on desktop don't trigger accidental drag
  // - TouchSensor: 200ms hold delay with 5px tolerance optimized for touchscreen tablets/mobile
  // - KeyboardSensor: accessible arrow key reordering
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Deduplicate lists by ID
  const uniqueLists = useMemo(() => {
    const seen = new Set<number>();
    return lists.filter((list) => {
      if (seen.has(list.id)) return false;
      seen.add(list.id);
      return true;
    });
  }, [lists]);

  // Container lookup helper: maps any droppable ID or card ID to its parent listId
  const findContainer = useCallback(
    (id: UniqueIdentifier | null | undefined): number | null => {
      if (!id) return null;
      if (typeof id === 'number') {
        const currentItems = itemsRef.current;
        if (id in currentItems) return id;
        for (const [key, cardsInList] of Object.entries(currentItems)) {
          if (cardsInList.some((c) => c.id === id)) {
            return Number(key);
          }
        }
        return null;
      }
      const str = String(id);
      if (str.startsWith('list-cards-')) {
        return Number(str.replace('list-cards-', ''));
      }
      if (str.startsWith('list-bottom-')) {
        return Number(str.replace('list-bottom-', ''));
      }
      if (str.startsWith('list-')) {
        return Number(str.replace('list-', ''));
      }
      if (str.startsWith('card-')) {
        const cardId = Number(str.replace('card-', ''));
        const currentItems = itemsRef.current;
        for (const [key, cardsInList] of Object.entries(currentItems)) {
          if (cardsInList.some((c) => c.id === cardId)) {
            return Number(key);
          }
        }
      }
      return null;
    },
    []
  );

  // Clauderic Multi-Container Collision Detection Strategy
  const collisionDetectionStrategy: CollisionDetection = useCallback(
    (args) => {
      const activeIdStr = String(args.active.id);

      // 1. Column drag: only collide with column containers
      if (activeIdStr.startsWith('list-')) {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (container) =>
              String(container.id).startsWith('list-') &&
              !String(container.id).startsWith('list-cards-') &&
              !String(container.id).startsWith('list-bottom-')
          ),
        });
      }

      // 2. Card drag:
      // If card was recently moved to a new container, keep track of lastOverId to prevent flickering
      if (recentlyMovedToNewContainer.current && lastOverId.current != null) {
        return [{ id: lastOverId.current }];
      }

      // First check pointerWithin
      const pointerIntersections = pointerWithin(args);
      const intersections =
        pointerIntersections.length > 0
          ? pointerIntersections
          : rectIntersection(args);

      let overId: UniqueIdentifier | null = getFirstCollision(intersections, 'id');

      if (overId != null) {
        const overIdStr = String(overId);
        // If over a list container or bottom dropzone, find if there are cards inside
        if (
          overIdStr.startsWith('list-cards-') ||
          overIdStr.startsWith('list-bottom-') ||
          overIdStr.startsWith('list-')
        ) {
          const containerListId = findContainer(overId);
          if (containerListId != null) {
            const containerItems = itemsRef.current[containerListId] || [];
            if (containerItems.length > 0) {
              // Return closest card inside this container
              const cardCollisions = closestCenter({
                ...args,
                droppableContainers: args.droppableContainers.filter(
                  (container) =>
                    String(container.id).startsWith('card-') &&
                    containerItems.some(
                      (c) => `card-${c.id}` === String(container.id)
                    )
                ),
              });
              if (cardCollisions.length > 0) {
                overId = cardCollisions[0].id;
              }
            }
          }
        }

        lastOverId.current = overId;
        return [{ id: overId }];
      }

      // When an item moves to a new container, layout shifts may briefly produce 0 intersections
      if (recentlyMovedToNewContainer.current) {
        lastOverId.current = activeIdStr;
        return [{ id: activeIdStr }];
      }

      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [findContainer]
  );

  // Real-time synchronization for Kanban lists across all members
  useRealtimeLists(boardId, {
    onListCreated: (newList) => {
      setLists((prev) => {
        if (prev.some((l) => l.id === newList.id)) {
          return prev.map((l) => (l.id === newList.id ? { ...l, ...newList } : l));
        }
        return [...prev, newList].sort((a, b) => a.position - b.position);
      });
      setItems((prev) => ({
        ...prev,
        [newList.id]: prev[newList.id] || [],
      }));
    },
    onListUpdated: (updatedList) => {
      setLists((prev) =>
        prev.map((l) => (l.id === updatedList.id ? { ...l, ...updatedList } : l))
      );
    },
    onListDeleted: (deletedListId) => {
      setLists((prev) => prev.filter((l) => l.id !== deletedListId));
      setItems((prev) => {
        const copy = { ...prev };
        delete copy[deletedListId];
        return copy;
      });
    },
    onListsReordered: (orderedListIds) => {
      if (activeListId !== null) return;
      setLists((prev) => {
        const map = new Map(prev.map((l) => [l.id, l]));
        const reordered = orderedListIds
          .map((id) => map.get(id))
          .filter(Boolean) as ListDTO[];
        const remainder = prev.filter((l) => !orderedListIds.includes(l.id));
        return [...reordered, ...remainder];
      });
    },
  });

  // Real-time synchronization for Kanban cards across all members
  useRealtimeCards(boardId, {
    onCardCreated: (newCard) => {
      setItems((prev) => {
        const list = prev[newCard.listId] || [];
        if (list.some((c) => c.id === newCard.id)) {
          return {
            ...prev,
            [newCard.listId]: list.map((c) =>
              c.id === newCard.id ? { ...c, ...newCard } : c
            ),
          };
        }
        const nextList = [newCard, ...list].sort(compareCards);
        return {
          ...prev,
          [newCard.listId]: nextList,
        };
      });
    },
    onCardUpdated: (updatedCard) => {
      setItems((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          const numKey = Number(k);
          next[numKey] = next[numKey].map((c) =>
            c.id === updatedCard.id ? { ...c, ...updatedCard } : c
          );
        }
        return next;
      });
    },
    onCardDeleted: (deletedCardId) => {
      setItems((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          const numKey = Number(k);
          next[numKey] = next[numKey].filter((c) => c.id !== deletedCardId);
        }
        return next;
      });
    },
    onCardMoved: (payload) => {
      // While actively dragging this card, don't interrupt active gesture
      if (activeCard !== null && activeCard.id === payload.card.id) return;
      setItems((prev) => {
        // Discard stale or identical echo events
        const targetList = prev[payload.targetListId] || [];
        const existing = targetList.find((c) => c.id === payload.card.id);
        if (
          existing &&
          existing.version >= payload.version &&
          existing.rank === payload.rank
        ) {
          return prev;
        }

        const next = { ...prev };
        // Remove from any prior list
        for (const k of Object.keys(next)) {
          const numKey = Number(k);
          next[numKey] = next[numKey].filter((c) => c.id !== payload.card.id);
        }
        // Add to targetListId with updated rank and version
        const updatedCard: CardDTO = {
          ...payload.card,
          listId: payload.targetListId,
          rank: payload.rank,
          version: payload.version,
        };
        const currentTargetCards = next[payload.targetListId] || [];
        next[payload.targetListId] = [...currentTargetCards, updatedCard].sort(compareCards);
        itemsRef.current = next;
        return next;
      });
    },
  });

  // Sync initialLists when changed from parent without losing local updates
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLists((prev) => {
      const map = new Map<number, ListDTO>();
      for (const l of initialLists) map.set(l.id, l);
      for (const l of prev) {
        if (!map.has(l.id)) map.set(l.id, l);
      }
      return Array.from(map.values()).sort((a, b) => a.position - b.position);
    });
  }, [initialLists]);

  // Sync initialCards ONLY when the prop reference truly changes from server,
  // NEVER on activeCard or drag state transitions to avoid wiping local optimistic moves
  const prevInitialCardsRef = useRef(initialCards);
  useEffect(() => {
    if (prevInitialCardsRef.current !== initialCards) {
      prevInitialCardsRef.current = initialCards;
      setItems((prev) => {
        if (activeCard !== null || activeListId !== null) return prev;
        return groupCardsByList(lists, initialCards);
      });
    }
  }, [initialCards, lists, activeCard, activeListId]);

  // Active list item for DragOverlay preview
  const activeList = useMemo(
    () => (activeListId ? uniqueLists.find((l) => l.id === activeListId) || null : null),
    [activeListId, uniqueLists]
  );

  // List Handlers
  const handleCreateList = async (title: string): Promise<boolean> => {
    const res = await createListAction({ boardId, title });
    if (res.success && res.data) {
      setLists((prev) => {
        if (prev.some((l) => l.id === res.data!.id)) {
          return prev.map((l) => (l.id === res.data!.id ? { ...l, ...res.data! } : l));
        }
        return [...prev, res.data!].sort((a, b) => a.position - b.position);
      });
      setItems((prev) => ({
        ...prev,
        [res.data!.id]: [],
      }));
      return true;
    }
    alert(res.message || 'Failed to create list');
    return false;
  };

  const handleUpdateTitle = async (listId: number, newTitle: string): Promise<boolean> => {
    setLists((prev) =>
      prev.map((l) => (l.id === listId ? { ...l, title: newTitle } : l))
    );

    const res = await updateListAction(listId, { title: newTitle });
    if (!res.success) {
      alert(res.message || 'Failed to update list title');
      setLists(initialLists);
      return false;
    }
    return true;
  };

  const handleDeleteList = async (listId: number): Promise<boolean> => {
    const backupLists = lists;
    const backupItems = itemsRef.current;

    setLists((prev) => prev.filter((l) => l.id !== listId));
    setItems((prev) => {
      const copy = { ...prev };
      delete copy[listId];
      return copy;
    });

    const res = await deleteListAction(listId);
    if (!res.success) {
      alert(res.message || 'Failed to delete list');
      setLists(backupLists);
      setItems(backupItems);
      return false;
    }
    return true;
  };

  const handleMoveColumn = async (listId: number, direction: 'left' | 'right') => {
    const currentIndex = uniqueLists.findIndex((l) => l.id === listId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= uniqueLists.length) return;

    const reordered = arrayMove(uniqueLists, currentIndex, targetIndex);
    setLists(reordered);

    const newOrderedIds = reordered.map((l) => l.id);
    const res = await reorderListsAction(boardId, newOrderedIds);
    if (!res.success) {
      alert(res.message || 'Failed to save column reordering');
      setLists(initialLists);
    }
  };

  // Card Handlers
  const handleCreateCard = async (listId: number, title: string): Promise<boolean> => {
    const res = await createCardAction({
      boardId,
      listId,
      title,
      position: 'top',
    });

    if (res.success && res.data) {
      setItems((prev) => {
        const list = prev[listId] || [];
        if (list.some((c) => c.id === res.data!.id)) {
          return {
            ...prev,
            [listId]: list.map((c) =>
              c.id === res.data!.id ? { ...c, ...res.data! } : c
            ),
          };
        }
        return {
          ...prev,
          [listId]: [res.data!, ...list],
        };
      });
      return true;
    }
    alert(res.message || 'Failed to create card');
    return false;
  };

  const handleUpdateCardTitle = async (cardId: number, newTitle: string): Promise<boolean> => {
    setItems((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        const numKey = Number(k);
        next[numKey] = next[numKey].map((c) =>
          c.id === cardId ? { ...c, title: newTitle } : c
        );
      }
      return next;
    });

    const res = await updateCardAction(cardId, { title: newTitle });
    if (!res.success) {
      alert(res.message || 'Failed to update card title');
      setItems(groupCardsByList(initialLists, initialCards));
      return false;
    }
    return true;
  };

  const handleDeleteCard = async (cardId: number): Promise<boolean> => {
    const backup = itemsRef.current;
    setItems((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        const numKey = Number(k);
        next[numKey] = next[numKey].filter((c) => c.id !== cardId);
      }
      return next;
    });

    const res = await deleteCardAction(cardId);
    if (!res.success) {
      alert(res.message || 'Failed to delete card');
      setItems(backup);
      return false;
    }
    return true;
  };

  const handleCardUpdated = (updated: CardDTO) => {
    setItems((prev) => {
      const next = { ...prev };
      for (const lId in next) {
        next[lId] = next[lId].map((c) => (c.id === updated.id ? updated : c));
      }
      itemsRef.current = next;
      return next;
    });
  };

  const handleUpdateCardDetails = async (
    cardId: number,
    input: UpdateCardInput
  ): Promise<boolean> => {
    const res = await updateCardAction(cardId, input);
    if (res.success && res.data) {
      const updated = res.data;
      handleCardUpdated(updated);
      return true;
    } else {
      alert(res.message || 'Gagal memperbarui kartu');
      return false;
    }
  };

  const handleMoveCardToListFromModal = async (
    cardId: number,
    targetListId: number
  ): Promise<boolean> => {
    const targetCards = items[targetListId] || [];
    const lastCard = targetCards[targetCards.length - 1];
    const res = await moveCardAction({
      cardId,
      targetListId,
      previousCardId: lastCard?.id || null,
    });

    if (res.success && res.data) {
      const moved = res.data;
      setItems((prev) => {
        const next = { ...prev };
        for (const lId in next) {
          next[lId] = next[lId].filter((c) => c.id !== cardId);
        }
        const targetList = [...(next[targetListId] || [])];
        targetList.push(moved);
        next[targetListId] = targetList.sort(compareCards);
        itemsRef.current = next;
        return next;
      });
      return true;
    } else {
      alert(res.message || 'Gagal memindahkan kartu');
      return false;
    }
  };

  const handleMoveCardStep = async (cardId: number, direction: 'up' | 'down') => {
    const containerId = findContainer(`card-${cardId}`);
    if (!containerId) return;

    const listCards = itemsRef.current[containerId] || [];
    const currentIndex = listCards.findIndex((c) => c.id === cardId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= listCards.length) return;

    let previousCardId: number | null = null;
    let nextCardId: number | null = null;

    if (direction === 'up') {
      previousCardId = targetIndex > 0 ? listCards[targetIndex - 1].id : null;
      nextCardId = listCards[targetIndex].id;
    } else {
      previousCardId = listCards[targetIndex].id;
      nextCardId = targetIndex < listCards.length - 1 ? listCards[targetIndex + 1].id : null;
    }

    // Optimistic local update
    const reordered = arrayMove(listCards, currentIndex, targetIndex);
    setItems((prev) => ({
      ...prev,
      [containerId]: reordered,
    }));

    const res = await moveCardAction({
      cardId,
      targetListId: containerId,
      previousCardId,
      nextCardId,
    });

    if (res.success && res.data) {
      setItems((prev) => {
        const list = prev[containerId] || [];
        return {
          ...prev,
          [containerId]: list.map((c) =>
            c.id === cardId
              ? { ...c, rank: res.data!.rank, version: res.data!.version }
              : c
          ),
        };
      });
    } else {
      alert(res.message || 'Failed to move card');
      setItems((prev) => ({
        ...prev,
        [containerId]: listCards,
      }));
    }
  };

  // Drag and Drop Coordination
  const handleDragStart = (event: DragStartEvent) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(30);
      } catch {
        // Ignore devices that do not permit haptics
      }
    }

    const activeData = event.active.data.current;
    if (activeData?.type === 'card' && activeData.card) {
      setActiveCard(activeData.card);
      setActiveListId(null);
      // Take snapshot of items for rollbacks
      clonedItems.current = JSON.parse(JSON.stringify(itemsRef.current));
    } else if (activeData?.type === 'column') {
      const rawId = String(event.active.id).replace('list-', '');
      setActiveListId(Number(rawId));
      setActiveCard(null);
      clonedItems.current = null;
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = String(active.id);
    if (!activeIdStr.startsWith('card-')) return;

    const overId = over.id;
    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(overId);

    // CRITICAL CLAUDERIC RULE:
    // When activeContainer === overContainer, DO NOT mutate state!
    // SortableContext handles the visual transforms smoothly via CSS translate.
    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    // Moving across container boundaries:
    setItems((prev) => {
      const activeItems = prev[activeContainer] || [];
      const overItems = prev[overContainer] || [];

      const activeCardId = Number(activeIdStr.replace('card-', ''));
      const activeIndex = activeItems.findIndex((c) => c.id === activeCardId);
      if (activeIndex === -1) return prev;

      const activeCardObj: CardDTO = {
        ...activeItems[activeIndex],
        listId: overContainer,
      };

      // Always remove activeCardId from overItems if somehow already present to prevent duplicate cards
      const cleanOverItems = overItems.filter((c) => c.id !== activeCardId);

      const overIdStr = String(overId);
      let nextOverItems: CardDTO[];

      if (overIdStr.startsWith('card-')) {
        const overCardId = Number(overIdStr.replace('card-', ''));
        const overIndex = cleanOverItems.findIndex((c) => c.id === overCardId);

        const isBelowOverItem =
          over &&
          active.rect.current.translated &&
          active.rect.current.translated.top >
            over.rect.top + over.rect.height;

        const modifier = isBelowOverItem ? 1 : 0;
        const newIndex =
          overIndex >= 0 ? overIndex + modifier : cleanOverItems.length;

        nextOverItems = [
          ...cleanOverItems.slice(0, newIndex),
          activeCardObj,
          ...cleanOverItems.slice(newIndex),
        ];
      } else {
        // Dropped over list droppable container or bottom drop target
        nextOverItems = [...cleanOverItems, activeCardObj];
      }

      recentlyMovedToNewContainer.current = true;

      const next = {
        ...prev,
        [activeContainer]: activeItems.filter((c) => c.id !== activeCardId),
        [overContainer]: nextOverItems,
      };
      itemsRef.current = next;
      return next;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    const currentActiveCard = activeCard;
    const currentActiveListId = activeListId;

    setActiveCard(null);
    setActiveListId(null);

    // If dropped outside droppable
    if (!over) {
      if (clonedItems.current) {
        setItems(clonedItems.current);
        itemsRef.current = clonedItems.current;
        clonedItems.current = null;
      }
      return;
    }

    // 1. Column Drag End
    if (currentActiveListId !== null) {
      const activeIdNum = currentActiveListId;
      const overIdNum = Number(String(over.id).replace('list-', ''));

      if (activeIdNum === overIdNum) return;

      const oldIndex = uniqueLists.findIndex((l) => l.id === activeIdNum);
      const newIndex = uniqueLists.findIndex((l) => l.id === overIdNum);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(uniqueLists, oldIndex, newIndex);
      setLists(reordered);

      const newOrderedIds = reordered.map((l) => l.id);
      const res = await reorderListsAction(boardId, newOrderedIds);
      if (!res.success) {
        alert(res.message || 'Failed to save column reordering');
        setLists(initialLists);
      }
      return;
    }

    // 2. Card Drag End
    if (!currentActiveCard) {
      clonedItems.current = null;
      return;
    }

    const activeIdStr = String(active.id);
    const activeCardId = Number(activeIdStr.replace('card-', ''));
    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id);

    if (!activeContainer || !overContainer) {
      if (clonedItems.current) {
        setItems(clonedItems.current);
        itemsRef.current = clonedItems.current;
        clonedItems.current = null;
      }
      return;
    }

    const overItems = itemsRef.current[overContainer] || [];
    const activeIndex = overItems.findIndex((c) => c.id === activeCardId);
    const overIdStr = String(over.id);

    let finalOverItems = overItems;

    if (overIdStr.startsWith('card-')) {
      const overCardId = Number(overIdStr.replace('card-', ''));
      const overIndex = overItems.findIndex((c) => c.id === overCardId);

      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        finalOverItems = arrayMove(overItems, activeIndex, overIndex);
      }
    } else if (overIdStr.startsWith('list-bottom-')) {
      // Explicit drop on bottom slot: move to the end of the list
      if (activeIndex !== -1 && activeIndex !== overItems.length - 1) {
        finalOverItems = arrayMove(overItems, activeIndex, overItems.length - 1);
      }
    }

    // Finalize state in target container
    setItems((prev) => {
      const next = {
        ...prev,
        [overContainer]: finalOverItems,
      };
      itemsRef.current = next;
      return next;
    });

    const finalIndex = finalOverItems.findIndex((c) => c.id === activeCardId);
    if (finalIndex === -1) {
      clonedItems.current = null;
      return;
    }

    const previousCardId = finalIndex > 0 ? finalOverItems[finalIndex - 1].id : null;
    const nextCardId =
      finalIndex < finalOverItems.length - 1 ? finalOverItems[finalIndex + 1].id : null;

    // Check if card position is completely unchanged
    const initialSnapshot = clonedItems.current;
    if (initialSnapshot) {
      const origContainerCards = initialSnapshot[overContainer] || [];
      const origIndex = origContainerCards.findIndex((c) => c.id === activeCardId);
      const wasInSameContainer =
        initialSnapshot[overContainer]?.some((c) => c.id === activeCardId) ?? false;
      if (wasInSameContainer && origIndex === finalIndex) {
        clonedItems.current = null;
        return;
      }
    }

    clonedItems.current = null;

    // Persist authoritative move to server with Rocicorp Fractional Indexing
    const res = await moveCardAction({
      cardId: activeCardId,
      targetListId: overContainer,
      previousCardId,
      nextCardId,
    });

    if (res.success && res.data) {
      setItems((prev) => {
        const list = prev[overContainer] || [];
        const updatedList = list.map((c) =>
          c.id === activeCardId
            ? {
                ...c,
                listId: overContainer,
                rank: res.data!.rank,
                version: res.data!.version,
              }
            : c
        );
        const next = {
          ...prev,
          [overContainer]: updatedList,
        };
        itemsRef.current = next;
        return next;
      });
    } else {
      alert(res.message || 'Failed to move card');
      if (initialSnapshot) {
        setItems(initialSnapshot);
        itemsRef.current = initialSnapshot;
      }
    }
  };

  const handleDragCancel = () => {
    if (clonedItems.current) {
      setItems(clonedItems.current);
      itemsRef.current = clonedItems.current;
      clonedItems.current = null;
    }
    setActiveCard(null);
    setActiveListId(null);
  };

  return (
    <DndContext
      id={`board-${boardId}-dnd`}
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
    >
      <SortableContext
        items={uniqueLists.map((l) => `list-${l.id}`)}
        strategy={horizontalListSortingStrategy}
      >
        <div
          className="flex-1 w-full overflow-x-auto p-4 sm:p-6 flex items-start gap-4 scrollbar-thin select-none"
          aria-label="Kanban board lists"
        >
          {/* Existing Lists */}
          {uniqueLists.map((list, index) => (
            <BoardColumn
              key={list.id}
              list={list}
              cards={items[list.id] || []}
              canUpdate={permissions.canUpdate}
              canDelete={permissions.canDelete}
              cardPermissions={cardPermissions}
              isDraggingCard={Boolean(activeCard)}
              onUpdateTitle={handleUpdateTitle}
              onDeleteList={handleDeleteList}
              onMoveLeft={
                permissions.canUpdate && index > 0
                  ? () => handleMoveColumn(list.id, 'left')
                  : undefined
              }
              onMoveRight={
                permissions.canUpdate && index < uniqueLists.length - 1
                  ? () => handleMoveColumn(list.id, 'right')
                  : undefined
              }
              onCreateCard={handleCreateCard}
              onUpdateCardTitle={handleUpdateCardTitle}
              onDeleteCard={handleDeleteCard}
              onMoveCardUp={(cardId) => handleMoveCardStep(cardId, 'up')}
              onMoveCardDown={(cardId) => handleMoveCardStep(cardId, 'down')}
              onCardClick={(card) => setSelectedCardId(card.id)}
            />
          ))}

          {/* Add New List Form */}
          {permissions.canCreate && (
            <CreateListForm boardId={boardId} onCreateList={handleCreateList} />
          )}

          {/* Empty State when no lists and cannot create */}
          {uniqueLists.length === 0 && !permissions.canCreate && (
            <div className="w-[300px] shrink-0 bg-white rounded-2xl border border-gray-200/90 p-8 text-center shadow-xs mx-auto my-12">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 mx-auto mb-3">
                <Layers className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">No lists available</h3>
              <p className="text-xs text-gray-500 mt-1">
                This board does not contain any lists yet.
              </p>
            </div>
          )}
        </div>
      </SortableContext>

      {/* Accessible visual drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeList ? (
          <div className="rotate-1 opacity-95 scale-102 pointer-events-none shadow-2xl">
            <BoardColumn
              list={activeList}
              cards={items[activeList.id] || []}
              canUpdate={false}
              canDelete={false}
              onUpdateTitle={async () => false}
              onDeleteList={async () => false}
              isOverlay
            />
          </div>
        ) : activeCard ? (
          <div className="w-[260px] rotate-2 opacity-95 pointer-events-none shadow-xl scale-102">
            <KanbanCard
              card={activeCard}
              canUpdate={false}
              canDelete={false}
              onUpdateTitle={async () => false}
              onDeleteCard={async () => false}
              isOverlay
            />
          </div>
        ) : null}
      </DragOverlay>

      {/* Card Detail Modal (65% Content / 35% Comments) */}
      {selectedCard && (
        <CardDetailModal
          isOpen={Boolean(selectedCard)}
          card={selectedCard}
          lists={uniqueLists}
          canUpdate={cardPermissions.canUpdate}
          canDelete={cardPermissions.canDelete}
          currentUserId={currentChatUser?.id || 0}
          currentUserName={currentChatUser?.name || currentChatUser?.username || 'Me'}
          onClose={() => setSelectedCardId(null)}
          onUpdateCard={handleUpdateCardDetails}
          onDeleteCard={async (cId) => {
            return await handleDeleteCard(cId);
          }}
          onMoveCardToList={handleMoveCardToListFromModal}
          onCardUpdated={handleCardUpdated}
        />
      )}
    </DndContext>
  );
}
