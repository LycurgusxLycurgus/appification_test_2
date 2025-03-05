import React, { useState, useEffect } from 'react';
import gameState from '../game/gameState';

/**
 * This TaskMenu is shown/hidden by pressing Tab in 2D or 3D mode.
 * In TASK_GAME mode, we are using the “in-canvas” approach (shooting tasks, etc.)
 * so we typically hide this overlay or let it be toggled if you like.
 */

const TaskMenu = () => {
  const [tasks, setTasks] = useState([...gameState.tasks]);
  const [newTask, setNewTask] = useState('');

  useEffect(() => {
    // Whenever tasks are added/completed, re-pull them from the gameState
    const handleTasksChange = () => {
      setTasks([...gameState.tasks]);
    };

    // Optionally, you could set up a small interval or subscription
    const intervalId = setInterval(handleTasksChange, 500);
    return () => clearInterval(intervalId);
  }, []);

  const addTask = () => {
    if (newTask.trim()) {
      gameState.tasks.push({ text: newTask.trim(), completed: false });
      setNewTask('');
    }
  };

  // By default, we rely on inputManager for toggling display. This component 
  // itself is always rendered. The style can be toggled with .style.display = 'none' externally.
  const overlayStyle = {
    display: 'none', // **start hidden**; inputManager toggles it
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '300px',
    backgroundColor: 'rgba(0,0,0,0.8)',
    color: 'white',
    padding: '20px',
    borderRadius: '10px',
    zIndex: 200
  };

  return (
    <div id="taskMenu" style={overlayStyle}>
      <h2>Task Manager</h2>
      <input
        type="text"
        value={newTask}
        onChange={(e) => setNewTask(e.target.value)}
        placeholder="Add a new task..."
        style={{ width: '100%', padding: '5px', margin: '5px 0' }}
      />
      <button onClick={addTask} style={{ marginRight: '10px' }}>
        Add Task
      </button>

      <ul id="taskList" style={{ listStyleType: 'none', padding: 0 }}>
        {tasks.map((task, index) => (
          <li
            key={index}
            style={{
              padding: '5px',
              margin: '5px 0',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '3px',
              display: 'flex',
              justifyContent: 'space-between'
            }}
          >
            <span
              style={{
                textDecoration: task.completed ? 'line-through' : 'none',
                opacity: task.completed ? 0.7 : 1
              }}
            >
              {task.text}
            </span>
          </li>
        ))}
      </ul>

      {/* A “Close” button that just hides the menu in 2D/3D */}
      <button
        onClick={() => {
          const menuEl = document.getElementById('taskMenu');
          if (menuEl) menuEl.style.display = 'none';
        }}
      >
        Close
      </button>
    </div>
  );
};

export default TaskMenu;
