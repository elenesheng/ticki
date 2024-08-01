import { useState, useCallback, useEffect } from 'react';
import useLocalStorage from '@/app/hooks/useLocalStorage';
import { v4 as uuidv4 } from 'uuid';
import { useSession } from 'next-auth/react';
import * as api from '@/app/lib/api';
import { useOperationQueue } from './useOperationQueue';
import { debounce } from '@/app/lib/utils/debounce';
import { TodoContextType, Todo } from '@/app/types/tasks';

export function useTaskProvider(): TodoContextType {
    const [todos, setTodos] = useLocalStorage<Todo[]>('todos', []);
    const [selectedTodoId, setSelectedTodoId] = useLocalStorage<string>('selectedTodoId', '');
    const [loading, setLoading] = useState(true);
    const { data: session } = useSession();
    const { addOperation, processQueue } = useOperationQueue(session);

    useEffect(() => {
        if (session) {
            fetchTodos();
        } else {
            setLoading(false);
        }
    }, [session]);

    const fetchTodos = async () => {
        try {
            const fetchedTodos = await api.fetchTodos();
            setTodos(fetchedTodos);
        } catch (error) {
            console.error('Failed to fetch todos:', error);
        } finally {
            setLoading(false);
        }
    };

    const debouncedAddTodo = debounce((newTodo: Todo) => {
        if (session) {
            addOperation({ type: 'add', payload: newTodo });
        }
    }, 300);

    const debouncedEditTodo = debounce((updatedTodo: Todo) => {
        if (session) {
            addOperation({ type: 'update', payload: updatedTodo });
        }
    }, 300);

    const addTodo = useCallback((name: string, description: string) => {
        const newTodo: Todo = { id: uuidv4(), name, description, completed: false, spentTime: 0 };
        setTodos(prevTodos => [...prevTodos, newTodo]);
        debouncedAddTodo(newTodo);
    }, [setTodos, session]);

    const editTodo = useCallback((todoId: string, name: string, description: string) => {
        setTodos(prevTodos =>
            prevTodos.map(todo =>
                todo.id === todoId ? { ...todo, name, description } : todo
            )
        );
        const updatedTodo = todos.find(todo => todo.id === todoId);
        if (updatedTodo) {
            debouncedEditTodo({ ...updatedTodo, name, description });
        }
    }, [setTodos, todos, session]);

    const removeTodo = useCallback((todoId: string) => {
        setTodos(prevTodos => prevTodos.filter(todo => todo.id !== todoId));
        if (session) {
            addOperation({ type: 'delete', payload: todoId });
        }
    }, [setTodos, session]);

    const toggleTodoCompletion = useCallback((todoId: string) => {
        setTodos(prevTodos =>
            prevTodos.map(todo =>
                todo.id === todoId ? { ...todo, completed: !todo.completed } : todo
            )
        );
        const updatedTodo = todos.find(todo => todo.id === todoId);
        if (updatedTodo) {
            debouncedEditTodo({ ...updatedTodo, completed: !updatedTodo.completed });
        }
    }, [setTodos, todos, session]);

    const setSpentTime = useCallback((todoId: string, timeSpent: number) => {
        setTodos(prevTodos =>
            prevTodos.map(todo =>
                todo.id === todoId ? { ...todo, spentTime: (todo.spentTime || 0) + timeSpent } : todo
            )
        );

        const updatedTodo = todos.find(todo => todo.id === todoId);
        if (updatedTodo) {
            debouncedEditTodo({ ...updatedTodo, spentTime: (updatedTodo.spentTime || 0) + timeSpent });
        }
    }, [setTodos, todos, session]);

    const clearAllTodos = useCallback(() => {
        setTodos([]);
        if (session) {
            addOperation({ type: 'clear', payload: null });
        }
    }, [setTodos, session]);

    const chooseTodo = useCallback((todoId: string) => {
        setSelectedTodoId(todoId);
    }, [setSelectedTodoId]);

    return {
        todos,
        loading,
        addTodo,
        removeTodo,
        toggleTodoCompletion,
        setSpentTime,
        clearAllTodos,
        chooseTodo,
        selectedTodoId,
        editTodo,
        setSelectedTodoId
    };
}