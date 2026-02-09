
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { supabase } from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import type { Cliente, Trabajo, TallerInfo } from './types';
import { WrenchScrewdriverIcon } from '@heroicons/react/24/solid';
import { applyAppTheme } from './constants';

// Lazy loading components
const Login = lazy(() => import('./components/Login'));
const TallerDashboard = lazy(() => import('./components/TallerDashboard'));
const ClientPortal = lazy(() => import('./components/ClientPortal'));
const ResetPassword = lazy(() => import('./components/ResetPassword'));
const SetInitialPassword = lazy(() => import('./components/SetInitialPassword'));

type AuthAction = 'APP' | 'PASSWORD_RECOVERY' | 'SET_INITIAL_PASSWORD';

const LoadingScreen = () => (
    <div className="flex h-[var(--app-height)] w-screen items-center justify-center bg-taller-light dark:bg-taller-dark transition-colors duration-500">
        <div className="relative flex flex-col items-center">
            {/* Círculo de pulso exterior */}
            <div className="absolute h-32 w-32 flex-shrink-0 rounded-full bg-taller-primary/10 animate-ping opacity-20"></div>

            <div className="relative h-20 w-20 flex-shrink-0 flex items-center justify-center">
                {/* Spinner principal */}
                <div className="absolute inset-0 border-4 border-taller-primary/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-taller-primary border-t-transparent rounded-full animate-spin"></div>
                {/* Icono central */}
                <WrenchScrewdriverIcon className="h-8 w-8 text-taller-primary animate-pulse" />
            </div>

            {/* Texto de carga */}
            <div className="mt-8 flex flex-col items-center gap-1">
                <span className="text-xs font-black text-taller-primary tracking-[0.3em] uppercase opacity-70">
                    Sincronizando
                </span>
                <div className="flex gap-1">
                    <div className="w-1 h-1 bg-taller-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1 h-1 bg-taller-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1 h-1 bg-taller-primary rounded-full animate-bounce"></div>
                </div>
            </div>
        </div>
    </div>
);

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const [authAction, setAuthAction] = useState<AuthAction>('APP');

    const [clientData, setClientData] = useState<Cliente | null>(null);
    const [clientTrabajos, setClientTrabajos] = useState<Trabajo[]>([]);
    const [tallerInfoForClient, setTallerInfoForClient] = useState<TallerInfo | null>(null);


    useEffect(() => {
        const processInitialParams = async () => {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const searchParams = new URLSearchParams(window.location.search);

            const type = searchParams.get('type') || hashParams.get('type');

            if (type === 'recovery') {
                setAuthAction('PASSWORD_RECOVERY');
            } else if (type === 'invite') {
                const email = searchParams.get('email');
                const password = searchParams.get('password');

                if (email && password) {
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email,
                        password
                    });

                    if (!error && data.session) {
                        setAuthAction('SET_INITIAL_PASSWORD');
                        window.history.replaceState(null, '', window.location.pathname);
                    } else {
                        console.error("Error en auto-login de invitación:", error?.message);
                        setAuthAction('APP');
                    }
                }
            }
        };

        processInitialParams();
    }, []);

    useEffect(() => {
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);

            if (_event === 'PASSWORD_RECOVERY') {
                setAuthAction('PASSWORD_RECOVERY');
            }

            if (_event === 'SIGNED_OUT') {
                setAuthAction('APP');
                setRole(null);
                setUser(null);
                setClientData(null);
                applyAppTheme();
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        const processSession = async () => {
            if (authAction !== 'APP') {
                setUser(session?.user ?? null);
                setRole(null);
                setClientData(null);
                setLoading(false);
                return;
            }

            if (!session?.user) {
                setUser(null);
                setRole(null);
                setClientData(null);
                setLoading(false);
                return;
            }

            const currentUser = session.user;
            const userRole = currentUser.user_metadata?.role || null;

            setUser(currentUser);
            setRole(userRole);

            if (userRole === 'taller') {
                setLoading(false);
            } else if (userRole === 'cliente') {
                try {
                    const { data: clientProfile, error: clientError } = await supabase
                        .from('clientes')
                        .select('*, vehiculos(*)')
                        .eq('id', currentUser.id)
                        .maybeSingle();

                    if (clientError) {
                        throw clientError;
                    }

                    if (clientProfile) {
                        setClientData(clientProfile as any);

                        const { data: tallerInfoData, error: tallerInfoError } = await supabase
                            .from('taller_info')
                            .select('*')
                            .eq('taller_id', clientProfile.taller_id)
                            .maybeSingle();

                        if (!tallerInfoError && tallerInfoData) {
                            const info: TallerInfo = {
                                nombre: tallerInfoData.nombre || 'Taller Mecánico',
                                telefono: tallerInfoData.telefono || '',
                                direccion: tallerInfoData.direccion || '',
                                cuit: tallerInfoData.cuit || '',
                                logoUrl: tallerInfoData.logo_url,
                                pdfTemplate: tallerInfoData.pdf_template || 'classic',
                                showLogoOnPdf: tallerInfoData.show_logo_on_pdf === true,
                                showCuitOnPdf: tallerInfoData.show_cuit_on_pdf !== false,
                                headerColor: tallerInfoData.header_color || '#334155',
                            };
                            setTallerInfoForClient(info);
                            applyAppTheme();

                        } else {
                            const tallerInfo = currentUser.user_metadata?.taller_info_ref || null;
                            const tallerName = tallerInfo?.nombre || currentUser.user_metadata?.taller_nombre_ref || 'Mi Taller';
                            const fallbackInfo = { ...tallerInfo, nombre: tallerName };
                            setTallerInfoForClient(fallbackInfo);
                        }

                        const { data: trabajosData, error: trabajosError } = await supabase
                            .from('trabajos')
                            .select('*')
                            .eq('cliente_id', currentUser.id)
                            .order('fecha_entrada', { ascending: false });

                        if (trabajosError) throw trabajosError;

                        const finalTrabajos = (trabajosData || []).map(t => ({
                            id: t.id,
                            tallerId: t.taller_id,
                            clienteId: t.cliente_id,
                            vehiculoId: t.vehiculo_id,
                            descripcion: t.descripcion,
                            partes: t.partes,
                            costoManoDeObra: t.costo_mano_de_obra,
                            costoEstimado: t.costo_estimado,
                            status: t.status,
                            fechaEntrada: t.fecha_entrada,
                            fechaSalida: t.fecha_salida,
                            kilometraje: t.kilometraje,
                        }));
                        setClientTrabajos(finalTrabajos as Trabajo[]);
                    }

                } catch (error: any) {
                    console.error("Error fetching client data, signing out: ", error.message);
                    await supabase.auth.signOut();
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };

        processSession();
    }, [session, authAction]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const handleAuthSuccess = () => {
        window.history.replaceState(null, '', window.location.pathname);
        setAuthAction('APP');
    };

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <Suspense fallback={<LoadingScreen />}>
            {authAction === 'SET_INITIAL_PASSWORD' && (
                <SetInitialPassword onSetSuccess={handleAuthSuccess} />
            )}

            {authAction === 'PASSWORD_RECOVERY' && (
                <ResetPassword onResetSuccess={handleAuthSuccess} />
            )}

            {authAction === 'APP' && !session && (
                <Login />
            )}

            {authAction === 'APP' && session && role === 'taller' && user && (
                <TallerDashboard onLogout={handleLogout} user={user} />
            )}

            {authAction === 'APP' && session && role === 'cliente' && clientData && (
                <ClientPortal client={clientData} trabajos={clientTrabajos} onLogout={handleLogout} tallerInfo={tallerInfoForClient} />
            )}

            {authAction === 'APP' && session && role === 'cliente' && !clientData && (
                <LoadingScreen />
            )}
        </Suspense>
    );
};

export default App;
