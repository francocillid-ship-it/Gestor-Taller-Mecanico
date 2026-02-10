
import React, { useState, useEffect } from 'react';
import type { UserRole } from '../types';
import { supabase } from '../supabaseClient';
import { WrenchScrewdriverIcon, ArrowLeftIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

type View = 'login' | 'signup' | 'forgotPassword';

const Login: React.FC = () => {
    const [view, setView] = useState<View>('login');
    // Default role to 'taller', user cannot change this during signup anymore
    const [role, setRole] = useState<UserRole>('taller');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [passwordValid, setPasswordValid] = useState(false);

    // Detect URL params for deep linking into Forgot Password
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const viewParam = params.get('view');
        const emailParam = params.get('email');

        if (viewParam === 'forgot_password') {
            setView('forgotPassword');
            if (emailParam) setEmail(emailParam);
        }
    }, []);

    useEffect(() => {
        if (view === 'signup') {
            const hasLength = password.length >= 6;
            const hasContent = /^(?=.*[A-Za-z])(?=.*\d).+$/.test(password);
            const matches = password === confirmPassword && password !== '';
            setPasswordValid(hasLength && hasContent && matches);
        } else {
            setPasswordValid(true); // Validation not needed for login
        }
    }, [password, confirmPassword, view]);

    const handleAuthAction = async (action: 'login' | 'signup') => {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            if (action === 'login') {
                // Login is generic, role is determined by metadata after login in App.tsx
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else if (action === 'signup') {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            role: 'taller', // Always register as taller from the public signup form
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
    
    const renderForgotPasswordForm = () => (
         <>
            <button onClick={() => { setView('login'); setError(null); setSuccessMessage(null); }} className="absolute top-4 left-4 text-taller-gray hover:text-taller-dark dark:hover:text-taller-light">
                <ArrowLeftIcon className="h-6 w-6"/>
            </button>
            <div className="flex justify-center mb-4">
                <WrenchScrewdriverIcon className="h-12 w-12 text-taller-primary"/>
            </div>
            <h2 className="text-2xl font-bold text-taller-dark dark:text-taller-light mb-2">
                Restablecer Contraseña
            </h2>
             <p className="text-sm text-taller-gray dark:text-gray-400 mb-6">
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
                    <label htmlFor="email" className="block text-sm font-medium text-taller-gray dark:text-gray-400 text-left">Email</label>
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
            {view === 'signup' && (
                <button onClick={() => { setView('login'); setError(null); }} className="absolute top-4 left-4 text-taller-gray hover:text-taller-dark dark:hover:text-taller-light">
                    <ArrowLeftIcon className="h-6 w-6"/>
                </button>
            )}
            
            <div className="flex justify-center mb-4">
                <WrenchScrewdriverIcon className="h-12 w-12 text-taller-primary"/>
            </div>

            <h2 className="text-2xl font-bold text-taller-dark dark:text-taller-light mb-6">
                {view === 'login' ? 'Iniciar Sesión' : 'Registrar Taller'}
            </h2>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (view === 'login' || view === 'signup') {
                        handleAuthAction(view);
                    }
                }}
                className="space-y-4"
            >
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-taller-gray dark:text-gray-400 text-left">Email</label>
                    <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" required/>
                </div>
                 <div>
                    <label htmlFor="password" className="block text-sm font-medium text-taller-gray dark:text-gray-400 text-left">Contraseña</label>
                    <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" required/>
                </div>
                {view === 'signup' && (
                    <>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-taller-gray dark:text-gray-400 text-left">Confirmar Contraseña</label>
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
                        {loading ? 'Procesando...' : (view === 'login' ? 'Iniciar Sesión' : 'Registrarse')}
                    </button>
                </div>
            </form>
            <div className="mt-6">
                <p className="text-sm text-center text-taller-gray dark:text-gray-400">
                    {view === 'login' ? (
                        <>
                            ¿No tienes una cuenta? <button onClick={() => { setView('signup'); setError(null); setPassword(''); }} className="font-medium text-taller-primary hover:underline">Registra tu Taller</button>
                        </>
                    ) : (
                         <>
                            ¿Ya tienes una cuenta? <button onClick={() => { setView('login'); setError(null); setPassword(''); setConfirmPassword(''); }} className="font-medium text-taller-primary hover:underline">Inicia sesión</button>
                        </>
                    )}
                </p>
            </div>
        </>
    )

    const renderCurrentView = () => {
        switch (view) {
            case 'forgotPassword':
                return renderForgotPasswordForm();
            default:
                return renderAuthForm();
        }
    };

    return (
        <div className="flex items-center justify-center app-height bg-gray-100 dark:bg-taller-dark">
            <div className="relative w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg text-center">
                {renderCurrentView()}
            </div>
        </div>
    );
};

export default Login;
