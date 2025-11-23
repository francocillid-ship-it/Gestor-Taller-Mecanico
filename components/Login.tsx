
import React, { useState, useEffect } from 'react';
import type { UserRole } from '../types';
import { supabase } from '../supabaseClient';
import { WrenchScrewdriverIcon, UserIcon, ArrowLeftIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

type View = 'selection' | 'login' | 'signup' | 'forgotPassword';

const Login: React.FC = () => {
    const [view, setView] = useState<View>('selection');
    const [role, setRole] = useState<UserRole | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [passwordValid, setPasswordValid] = useState(false);

    useEffect(() => {
        if (view === 'signup' && role === 'taller') {
            const hasLength = password.length >= 6;
            const hasContent = /^(?=.*[A-Za-z])(?=.*\d).+$/.test(password);
            const matches = password === confirmPassword && password !== '';
            setPasswordValid(hasLength && hasContent && matches);
        } else {
            setPasswordValid(true); // Validation not needed for login or client signup
        }
    }, [password, confirmPassword, view, role]);

    const handleRoleSelect = (selectedRole: UserRole) => {
        setRole(selectedRole);
        setView('login');
        setError(null);
        setSuccessMessage(null);
        setPassword('');
        setConfirmPassword('');
    };

    const handleAuthAction = async (action: 'login' | 'signup') => {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

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
                alert('¡Registro exitoso! Por favor, revise su correo para confirmar su cuenta.');
                setView('login');
            }
        } catch (err: any) {
            setError(err.message || 'Ha ocurrido un error.');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin,
            });
            if (error) throw error;
            setSuccessMessage('Se han enviado las instrucciones para restablecer la contraseña a tu correo.');
        } catch (err: any) {
            setError(err.message || 'Error al enviar el email.');
        } finally {
            setLoading(false);
        }
    };

    const renderSelectionView = () => (
        <>
            <div className="flex justify-center">
                <WrenchScrewdriverIcon className="h-16 w-16 text-taller-primary"/>
            </div>
            <h1 className="text-3xl font-bold text-taller-dark dark:text-taller-light">Bienvenido a Gestor Taller</h1>
            <p className="text-taller-gray dark:text-gray-400">
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
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 font-semibold text-taller-primary bg-taller-light border border-taller-primary rounded-lg hover:bg-blue-100 dark:bg-gray-700 dark:text-taller-light dark:border-taller-secondary dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary transition-transform transform hover:scale-105"
                >
                    <UserIcon className="h-6 w-6" />
                    <span>Entrar como Cliente</span>
                </button>
            </div>
        </>
    );
    
    const renderForgotPasswordForm = () => (
         <>
            <button onClick={() => { setView('login'); setError(null); setSuccessMessage(null); }} className="absolute top-4 left-4 text-taller-gray hover:text-taller-dark dark:hover:text-taller-light">
                <ArrowLeftIcon className="h-6 w-6"/>
            </button>
            <h2 className="text-2xl font-bold text-taller-dark dark:text-taller-light pt-8">
                Restablecer Contraseña
            </h2>
             <p className="text-sm text-taller-gray dark:text-gray-400">
                Ingresa tu email y te enviaremos las instrucciones.
            </p>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    handlePasswordReset();
                }}
                className="space-y-4"
            >
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Email</label>
                    <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" required/>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
                <div className="pt-2">
                    <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? 'Enviando...' : 'Enviar Instrucciones'}
                    </button>
                </div>
            </form>
        </>
    );

    const renderAuthForm = () => (
        <>
            <button onClick={() => { setView('selection'); setRole(null); }} className="absolute top-4 left-4 text-taller-gray hover:text-taller-dark dark:hover:text-taller-light">
                <ArrowLeftIcon className="h-6 w-6"/>
            </button>
            <h2 className="text-2xl font-bold text-taller-dark dark:text-taller-light pt-8">
                {view === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'} como <span className="capitalize text-taller-primary">{role}</span>
            </h2>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    // FIX: Resolved a TypeScript error by narrowing the type of the `view` variable. The `if` condition now explicitly checks for 'login' or 'signup' before calling `handleAuthAction`, ensuring type safety.
                    if (view === 'login' || view === 'signup') {
                        handleAuthAction(view);
                    }
                }}
                className="space-y-4"
            >
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Email</label>
                    <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" required/>
                </div>
                 <div>
                    <label htmlFor="password" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Contraseña</label>
                    <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" required/>
                </div>
                {view === 'signup' && role === 'taller' && (
                    <>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Confirmar Contraseña</label>
                            <input type="password" id="confirmPassword" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" required/>
                        </div>
                        <div className="text-xs text-left text-taller-gray dark:text-gray-400 space-y-1 pt-1">
                            <p className={`flex items-center gap-2 transition-colors ${password.length >= 6 ? 'text-green-600' : 'text-taller-gray dark:text-gray-400'}`}>
                                {password.length >= 6 ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                                <span>Mínimo 6 caracteres.</span>
                            </p>
                            <p className={`flex items-center gap-2 transition-colors ${/^(?=.*[A-Za-z])(?=.*\d).+$/.test(password) ? 'text-green-600' : 'text-taller-gray dark:text-gray-400'}`}>
                                {/^(?=.*[A-Za-z])(?=.*\d).+$/.test(password) ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                                <span>Al menos una letra y un número.</span>
                            </p>
                            <p className={`flex items-center gap-2 transition-colors ${password && password === confirmPassword ? 'text-green-600' : 'text-taller-gray dark:text-gray-400'}`}>
                                {password && confirmPassword && password === confirmPassword ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                                <span>Las contraseñas coinciden.</span>
                            </p>
                        </div>
                    </>
                )}
                {view === 'login' && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 text-taller-primary focus:ring-taller-primary border-gray-300 dark:border-gray-600 rounded"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-taller-gray dark:text-gray-400">
                                Mantener sesión
                            </label>
                        </div>
                        <div className="text-sm">
                            <button
                                type="button"
                                onClick={() => {
                                    setView('forgotPassword');
                                    setError(null);
                                    setSuccessMessage(null);
                                }}
                                className="font-medium text-taller-primary hover:underline focus:outline-none"
                            >
                                ¿Olvidaste la contraseña?
                            </button>
                        </div>
                    </div>
                )}
                 {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="pt-2">
                    <button type="submit" disabled={loading || !passwordValid} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? 'Procesando...' : (view === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta')}
                    </button>
                </div>
            </form>
            <p className="text-sm text-center text-taller-gray dark:text-gray-400">
                {view === 'login' ? (
                    role === 'taller' ? (
                        <>
                            ¿No tienes una cuenta? <button onClick={() => { setView('signup'); setError(null); setPassword(''); }} className="font-medium text-taller-primary hover:underline">Crea una</button>
                        </>
                    ) : (
                        <span className="text-xs block mt-2 opacity-75">Solicite su acceso a su taller de confianza.</span>
                    )
                ) : (
                     <>
                        ¿Ya tienes una cuenta? <button onClick={() => { setView('login'); setError(null); setPassword(''); setConfirmPassword(''); }} className="font-medium text-taller-primary hover:underline">Inicia sesión</button>
                    </>
                )}
            </p>
        </>
    )

    const renderCurrentView = () => {
        switch (view) {
            case 'selection':
                return renderSelectionView();
            case 'forgotPassword':
                return renderForgotPasswordForm();
            default:
                return renderAuthForm();
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-taller-dark">
            <div className="relative w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg text-center">
                {renderCurrentView()}
            </div>
        </div>
    );
};

export default Login;
