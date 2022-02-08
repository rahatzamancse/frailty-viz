import React from 'react';
import styled from 'styled-components';
import { Draggable } from 'react-beautiful-dnd';

const colorCategory1 = "#d282beff"; // middle-purple
const colorCategory2 = "#a6d9efff"; // uranian-blue
const colorCategory3 = "#ffa770ff"; // atomic-tangerine
const colorCategory4 = "#e5f684ff"; // mindaro
const colorCategory5 = "#fef1f3ff"; // lavender-blush

const Container = styled.div`
    border: 1px solid lightgrey;
    border-radius: 2px;
    padding: 8px;
    margin-bottom: 8px;
    background-color: ${props => (
        // @ts-ignore
        [colorCategory1, colorCategory2, colorCategory3, colorCategory4, colorCategory5][props.category-1]
    )};
`;

const Task = ({task, index}) => {
    return (
        <Draggable draggableId={task.id} index={index}>
            {(provided, snapshot) => (
                <Container
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    ref={provided.innerRef}
                    // @ts-ignore
                    category={task.category}
                >
                    {task.label}
                </Container>

            )}
        </Draggable>
    )
};

export default Task;