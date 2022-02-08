import React from 'react';
import useFetch from "react-fetch-hook";
// import autoComplete from "@tarekraafat/autocomplete.js";
import { DragDropContext } from "react-beautiful-dnd";
import Column from "../components/Column";


const suggestionDummyNode = {
    "id": "uniprot_P31944",
    "label": "uniprot_P31944",
    "category": 1
}
const dummyNode = {
    "id": "uniprot_P05231",
    "label": "Interleukin_6",
    "category": 1
}


let dummyData = {
    tasks: [dummyNode, suggestionDummyNode],
    columns: {
        'column-1': {
            id: 'column-1',
            title: 'Search Result',
            taskIds: [suggestionDummyNode.id],
        },
        'column-2': {
            id: 'column-2',
            title: 'Pinned',
            taskIds: [dummyNode.id],
        }
    },
    columnOrder: ['column-1', 'column-2']
};



const EntityAutoComplete = ({ fromEntityAutoComplete }) => {
    let [dataState, setDataState] = React.useState(dummyData);

    async function getSuggestions(value) {
    }

    const handleChange = (event) => {
        if (event.target.value.length === 0) return;

        fetch(`http://127.0.0.1:8000/searchnode/${event.target.value}/5`).then(response => response.json()).then(suggestions => {
            suggestions = suggestions['matches'];
            const tasksList = dataState.columns["column-2"].taskIds.map(taskId => dataState.tasks.find(task => task.id == taskId));
            const allTasks = tasksList.concat(suggestions);

            const newState = {
                ...dataState,
                tasks: allTasks,
            }
            newState.columns["column-1"].taskIds = suggestions.map(task => task.id);
            setDataState(newState);
        });
    }

    const onDragEnd = result => {
        const {destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const start = dataState.columns[source.droppableId];
        const finish = dataState.columns[destination.droppableId];

        if (start === finish) {
            const newTaskIds = Array.from(start.taskIds);
            newTaskIds.splice(source.index, 1);
            newTaskIds.splice(destination.index, 0, draggableId);

            const newColumn = {
                ...start,
                taskIds: newTaskIds
            }
            const newState = {
                ...dataState,
                columns: {
                    ...dataState.columns,
                    [newColumn.id]: newColumn,
                },
            }
            setDataState(newState);
            return;
        }
        const startTaskIds = Array.from(start.taskIds);
        startTaskIds.splice(source.index, 1);
        const newStart = {
            ...start,
            taskIds: startTaskIds,
        };
        const finishTaskIds = Array.from(finish.taskIds);
        finishTaskIds.splice(destination.index, 0, draggableId);
        const newFinish = {
            ...finish,
            taskIds: finishTaskIds,
        }
        const newState = {
            ...dataState,
            columns: {
                ...dataState.columns,
                [newStart.id]: newStart,
                [newFinish.id]: newFinish,
            }
        };
        setDataState(newState);
    }

    React.useEffect(() => {
        const nodeList = dataState.columns['column-2'].taskIds;
        fromEntityAutoComplete(nodeList);

    }, [dataState.columns['column-2'].taskIds])

    return <div>
        <div className="form-floating mb-3">
            <input type="search" className="form-control" id="entity_name" placeholder="Interleukin-6" aria-label="Enter Name or ID of entity" onChange={handleChange} />
            <label htmlFor="entity_name">Search for Entity</label>
        </div>

        <DragDropContext
            onDragEnd={onDragEnd}
        >
            {dataState.columnOrder.map(columnId => {
                const column = dataState.columns[columnId];
                const tasks = column.taskIds.map(taskId => dataState.tasks.find(task => task.id === taskId));
                return <Column key={column.id} column={column} tasks={tasks} />
            })}
        </DragDropContext>
    </div>
}

export default EntityAutoComplete;