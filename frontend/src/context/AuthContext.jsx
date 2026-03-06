import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const dummyUser = { name: "Guest", email: "guest@example.com", id: "guest123" }
    const [user, setUser] = useState(dummyUser)

    const login = (userData, token) => {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(userData))
        setUser(userData)
    }

    const logout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(dummyUser)
    }

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuth: true }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
