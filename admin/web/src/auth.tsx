import { createContext, useContext } from 'react';

/** Сессия истекла посреди работы — App показывает вход. */
export const AuthLostContext = createContext<() => void>(() => {});
export const useAuthLost = () => useContext(AuthLostContext);
