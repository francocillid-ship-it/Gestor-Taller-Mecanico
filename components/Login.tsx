import React, { useState } from 'react';
import type { UserRole } from '../types';
import { supabase } from '../supabaseClient';
import { WrenchScrewdriverIcon, UserIcon, ArrowLeftIcon } from '@heroicons/react/24/solid';

type View = 'selection' | 'login' | 'signup';

const Login: React.FC = () => {
    const [view, setView] = useState<View>('selection');
    const [role, setRole] = useState<UserRole | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleRoleSelect = (selectedRole: UserRole) => {
        setRole(selectedRole);
        setView('login');
        setError(null);
    };

    const handleAuthAction = async (action: 'login' | 'signup') => {
        setLoading(true);
        setError(null);

        try {
            if (action === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else if (action === 'signup') {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            role: role,
                        },
                    },
                });
                if (error) throw error;
                // Maybe show a "check your email" message here
            }
        } catch (err: any) {
            setError(err.message || 'Ha ocurrido un error.');
        } finally {
            setLoading(false);
        }
    };

    const renderSelectionView = () => (
        <>
            <div className="flex justify-center">
                <WrenchScrewdriverIcon className="h-16 w-16 text-taller-primary"/>
            </div>
            <h1 className="text-3xl font-bold text-taller-dark">Bienvenido a Gestor Taller</h1>
            <p className="text-taller-gray">
                Seleccione su tipo de acceso para continuar.
            </p>
            <div className="space-y-4 pt-4">
                <button
                    onClick={() => handleRoleSelect('taller')}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 font-semibold text-white bg-taller-primary rounded-lg shadow-md hover:bg-taller-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-secondary transition-transform transform hover:scale-105"
                >
                    <WrenchScrewdriverIcon className="h-6 w-6" />
                    <span>Entrar como Taller</span>
                </button>
                <button
                    onClick={() => handleRoleSelect('cliente')}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 font-semibold text-taller-primary bg-taller-light border border-taller-primary rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary transition-transform transform hover:scale-105"
                >
                    <UserIcon className="h-6 w-6" />
                    <span>Entrar como Cliente</span>
                </button>
            </div>
        </>
    );
    
    const renderAuthForm = () => (
        <>
            <button onClick={() => { setView('selection'); setRole(null); }} className="absolute top-4 left-4 text-taller-gray hover:text-taller-dark">
                <ArrowLeftIcon className="h-6 w-6"/>
            </button>
            <h2 className="text-2xl font-bold text-taller-dark pt-8">
                {view === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'} como <span className="capitalize text-taller-primary">{role}</span>
            </h2>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    // FIX: The `view` state could be 'selection', which is not a valid argument type for `handleAuthAction`. This check narrows the type of `view`.
                    if (view !== 'selection') {
                        handleAuthAction(view);
                    }
                }}
                className="space-y-4"
            >
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-taller-gray">Email</label>
                    <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                </div>
                 <div>
                    <label htmlFor="password" className="block text-sm font-medium text-taller-gray">Contraseña</label>
                    <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                </div>
                {view === 'login' && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 text-taller-primary focus:ring-taller-primary border-gray-300 rounded"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-taller-gray">
                                Mantener sesión iniciada
                            </label>
                        </div>
                    </div>
                )}
                 {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="pt-2">
                    <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary disabled:opacity-50">
                        {loading ? 'Procesando...' : (view === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta')}
                    </button>
                </div>
            </form>
            <p className="text-sm text-center">
                {view === 'login' ? (
                    <>
                        ¿No tienes una cuenta? <button onClick={() => { setView('signup'); setError(null); }} className="font-medium text-taller-primary hover:underline">Crear una</button>
                    </>
                ) : (
                     <>
                        ¿Ya tienes una cuenta? <button onClick={() => { setView('login'); setError(null); }} className="font-medium text-taller-primary hover:underline">Inicia sesión</button>
                    </>
                )}
            </p>
        </>
    )

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="relative w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-lg text-center">
                {view === 'selection' ? renderSelectionView() : renderAuthForm()}
            </div>
        </div>
    );
};

export default Login;