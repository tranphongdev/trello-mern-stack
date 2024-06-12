import { useCallback, useEffect, useRef, useState } from 'react';
import { cloneDeep } from 'lodash';
import { mapOrder } from '~/utils/sorts';
import { arrayMove } from '@dnd-kit/sortable';
import Box from '@mui/material/Box';
import {
    DndContext,
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor,
    DragOverlay,
    defaultDropAnimationSideEffects,
    closestCorners,
    pointerWithin,
    rectIntersection,
    getFirstCollision,
    closestCenter,
} from '@dnd-kit/core';

import ListColumns from './ListColumns/ListColumns';
import Column from './ListColumns/Column/Column';
import Card from './ListColumns/Column/ListCards/Card/Card';

const ACTIVE_DRAG_ITEM_TYPE = {
    COLUMN: 'ACTIVE_DRAG_ITEM_TYPE_COLUMN',
    CARD: 'ACTIVE_DRAG_ITEM_TYPE_CARD',
};

function BoardContent({ board }) {
    // https://docs.dndkit.com/api-documentation/sensors
    // const poiterSensor = useSensor(PointerSensor, {activationConstraint: { distance: 10, }, });
    const mouseSensor = useSensor(MouseSensor, {
        activationConstraint: {
            distance: 10,
        },
    });
    // Nhấn giữ 250ms va dung sai của cảm ứng thì mới kích hoạt event (di chuyển lệch 500px)
    const touchSensor = useSensor(TouchSensor, {
        activationConstraint: {
            delay: 250,
            tolerance: 500,
        },
    });

    // const sensors = useSensors(poiterSensor);
    // Sử dụng 2 loại sensors là mouse và touch để có trải nghiệm trên mobile tốt nhất
    const sensors = useSensors(mouseSensor, touchSensor);

    const [orderedColumns, setOrderedColumns] = useState([]);

    // Cùng 1 thời điểm chỉ có card or column được kéo
    const [activeDragItemId, setActiveDragItemId] = useState(null);
    const [activeDragItemType, setActiveDragItemType] = useState(null);
    const [activeDragItemData, setActiveDragItemData] = useState(null);
    const [oldColumnWhenDraggingCard, setOldColumnWhenDraggingCard] = useState(null);

    const lastOverId = useRef(null);

    useEffect(() => {
        setOrderedColumns(mapOrder(board?.columns, board?.columnOrderIds, '_id'));
    }, [board]);

    // Tìm 1 cái column theo CardId
    const findColumnByCardId = (cardId) => {
        return orderedColumns.find((column) => column.cards.map((card) => card._id)?.includes(cardId));
    };

    const moveCardBetweenDifferentColumns = (
        overColumn,
        overCardId,
        active,
        over,
        activeColumn,
        activeDraggingCardId,
        activeDraggingCardData,
    ) => {
        setOrderedColumns((prev) => {
            // Tìm vị trí của cái overCard  trong column đích (nơi card sắp được thả)
            const overCardIndex = overColumn?.cards?.findIndex((card) => card._id === overCardId);

            // Tính cardIndex mới
            let newCardIndex;
            const isBelowOverItem =
                active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height;
            const modifier = isBelowOverItem ? 1 : 0;
            newCardIndex = overCardIndex >= 0 ? overCardIndex + modifier : overColumn?.cards?.length + 1;

            const nextColumns = cloneDeep(prev);
            const nextActiveColumn = nextColumns.find((column) => column._id === activeColumn._id);
            const nextOverColumn = nextColumns.find((column) => column._id === overColumn._id);

            // Column cũ
            if (nextActiveColumn) {
                //Xoá card ở cái column active (column cũ trước khi kéo sang column mới)
                nextActiveColumn.cards = nextActiveColumn.cards.filter((card) => card._id !== activeDraggingCardId);

                // Cập nhật lại mảng OrderIds cho chuẩn dữ liệu
                nextActiveColumn.columnOrderIds = nextActiveColumn.cards.map((card) => card._id);
            }
            // Column mới
            if (nextOverColumn) {
                //Kiểm tra xem card đang kéo nó có tồn tại ở overColumn chưa, nếu có thì xoá nó trước
                nextOverColumn.cards = nextOverColumn.cards.filter((card) => card._id !== activeDraggingCardId);

                const rebuild_activeDraggingCardData = {
                    ...activeDraggingCardData,
                    columnId: nextOverColumn._id,
                };

                // Tiếp là thêm cái card đang kéo vào overColumn theo vị trí mới
                nextOverColumn.cards = nextOverColumn.cards.toSpliced(newCardIndex, 0, rebuild_activeDraggingCardData);

                // Cập nhật lại mảng OrderIds cho chuẩn dữ liệu
                nextOverColumn.columnOrderIds = nextOverColumn.cards.map((card) => card._id);
            }

            return nextColumns;
        });
    };

    const handleDragStart = (event) => {
        setActiveDragItemId(event?.active?.id);
        setActiveDragItemType(
            event?.active?.data?.current?.columnId ? ACTIVE_DRAG_ITEM_TYPE.CARD : ACTIVE_DRAG_ITEM_TYPE.COLUMN,
        );
        setActiveDragItemData(event?.active?.data?.current);

        if (event?.active?.data?.current?.columnId) {
            setOldColumnWhenDraggingCard(findColumnByCardId(event?.active?.id));
        }
    };

    const handleDragOver = (event) => {
        // Không làm gì nếu đang kéo column
        if (activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.COLUMN) return;

        const { active, over } = event;
        // Nếu không tồn tại active hoặc over thì không làm gì tránh crash trang
        if (!active || !over) return;

        const {
            id: activeDraggingCardId,
            data: { current: activeDraggingCardData },
        } = active;
        const { id: overCardId } = over;

        // Tìm column bắt đầu và column kết thúc khi kéo
        const activeColumn = findColumnByCardId(activeDraggingCardId);
        const overColumn = findColumnByCardId(overCardId);

        // Nếu không tồn tại 2 colum thì exit
        if (!activeColumn || !overColumn) return;

        // Nếu kéo giữa 2 column khác nhau mới xử lý
        if (activeColumn._id !== overColumn._id) {
            moveCardBetweenDifferentColumns(
                overColumn,
                overCardId,
                active,
                over,
                activeColumn,
                activeDraggingCardId,
                activeDraggingCardData,
            );
        }
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        // Nếu không tồn tại active hoặc over thì không làm gì tránh crash trang
        if (!active || !over) return;

        // Xử lý kéo thả card
        if (activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.CARD) {
            const {
                id: activeDraggingCardId,
                data: { current: activeDraggingCardData },
            } = active;
            const { id: overCardId } = over;

            // Tìm column bắt đầu và column kết thúc khi kéo
            const activeColumn = findColumnByCardId(activeDraggingCardId);
            const overColumn = findColumnByCardId(overCardId);

            // Nếu không tồn tại 2 colum thì exit
            if (!activeColumn || !overColumn) return;

            if (oldColumnWhenDraggingCard._id !== overColumn._id) {
                moveCardBetweenDifferentColumns(
                    overColumn,
                    overCardId,
                    active,
                    over,
                    activeColumn,
                    activeDraggingCardId,
                    activeDraggingCardData,
                );
            } else {
                // Kéo thả card trong cùng 1 column

                // Lấy vị trí cũ từ thằng active
                const oldCardIndex = oldColumnWhenDraggingCard?.cards?.findIndex((c) => c._id === activeDragItemId);
                // Lấy vị trí mới từ thằng active
                const newCardIndex = overColumn?.cards?.findIndex((c) => c._id === overCardId);

                // Dùng arrmove vì kéo card trong 1 column tương tự như kéo 1 column trong boardcontent
                const dndOrderedCards = arrayMove(oldColumnWhenDraggingCard?.cards, oldCardIndex, newCardIndex);

                setOrderedColumns((prev) => {
                    const nextColumns = cloneDeep(prev);

                    const targetColumn = nextColumns.find((c) => c._id === overColumn._id);
                    targetColumn.cards = dndOrderedCards;
                    targetColumn.cardOrderIds = dndOrderedCards.map((card) => card._id);

                    return nextColumns;
                });
            }
        }

        // Xử lý kéo thả column trong boardContent
        if (activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.COLUMN) {
            if (active.id !== over.id) {
                // Lấy vị trí cũ từ thằng active
                const oldColumnIndex = orderedColumns.findIndex((c) => c._id === active.id);
                // Lấy vị trí mới từ thằng active
                const newColumnIndex = orderedColumns.findIndex((c) => c._id === over.id);

                // Dùng araymove sắp xếp lại mảng column
                const dndOrderedColumns = arrayMove(orderedColumns, oldColumnIndex, newColumnIndex);
                // const dndOrderedColumnsIds = dndOrderedColumns.map((c) => c._id);

                // Cập nhật state sau khi kéo thả
                setOrderedColumns(dndOrderedColumns);
            }
        }

        // Những dữ liệu sau khi kéo thả phải đưa giá trị về null
        setActiveDragItemId(null);
        setActiveDragItemData(null);
        setActiveDragItemType(null);
        setOldColumnWhenDraggingCard(null);
    };

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: { active: { opacity: '0.5' } },
        }),
    };

    const collisionDetectionStrategy = useCallback(
        (args) => {
            if (activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.COLUMN) {
                return closestCorners({ ...args });
            }

            const pointerIntersections = pointerWithin(args);
            const intersections = !!pointerIntersections?.length ? pointerIntersections : rectIntersection(args);

            let overId = getFirstCollision(intersections, 'id');
            if (overId) {
                const checkColumn = orderedColumns.find((column) => column._id === overId);
                if (checkColumn) {
                    overId = closestCenter({
                        ...args,
                        droppableContainers: args.droppableContainers.filter((container) => {
                            return container.id !== overId && checkColumn?.cardOrderIds?.includes(container.id);
                        }),
                    })[0]?.id;
                }

                lastOverId.current = overId;
                return [{ id: overId }];
            }

            return lastOverId.current ? [{ id: lastOverId.current }] : [];
        },
        [activeDragItemType, orderedColumns],
    );

    return (
        <DndContext
            sensors={sensors}
            // collisionDetection={closestCorners}
            collisionDetection={collisionDetectionStrategy}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragStart={handleDragStart}
        >
            <Box
                sx={{
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#34495e' : '#1976d2'),
                    width: '100%',
                    height: (theme) => theme.trello.boardContenteight,
                    display: 'flex',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    p: '10px 0',
                }}
            >
                <ListColumns columns={orderedColumns} />
                <DragOverlay dropAnimation={dropAnimation}>
                    {!activeDragItemType && null}
                    {activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.COLUMN && <Column column={activeDragItemData} />}
                    {activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.CARD && <Card card={activeDragItemData} />}
                </DragOverlay>
            </Box>
        </DndContext>
    );
}

export default BoardContent;
