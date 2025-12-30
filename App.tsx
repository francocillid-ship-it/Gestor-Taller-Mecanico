import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import Login from './components/Login';
import TallerDashboard from './components/TallerDashboard';
import ClientPortal from './components/ClientPortal';
import ResetPassword from './components/ResetPassword';
import SetInitialPassword from './components/SetInitialPassword';
import type { Cliente, Trabajo, TallerInfo } from './types';
import { applyAppTheme } from './constants';

type AuthAction = 'APP' | 'PASSWORD_RECOVERY' | 'SET_INITIAL_PASSWORD';

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
                     // Intentamos iniciar sesión con la clave temporal
                     const { data, error } = await supabase.auth.signInWithPassword({
                         email,
                         password
                     });
                     
                     if (!error && data.session) {
                         setAuthAction('SET_INITIAL_PASSWORD');
                         // Limpiamos la URL para seguridad
                         window.history.replaceState(null, '', window.location.pathname);
                     } else {
                         console.error("Error en auto-login de invitación:", error?.message);
                         setAuthAction('APP'); // Fallback al login normal
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
                applyAppTheme('slate'); 
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
                                appTheme: tallerInfoData.app_theme || 'slate'
                            };
                            setTallerInfoForClient(info);
                            
                            if (info.appTheme) {
                                applyAppTheme(info.appTheme);
                            }

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
        return <div className="flex h-screen items-center justify-center">Cargando...</div>;
    }

    if (authAction === 'SET_INITIAL_PASSWORD') {
        return <SetInitialPassword onSetSuccess={handleAuthSuccess} />;
    }

    if (authAction === 'PASSWORD_RECOVERY') {
        return <ResetPassword onResetSuccess={handleAuthSuccess} />;
    }
    
    if (!session) {
        return <Login />;
    }

    if (role === 'taller') {
        return <TallerDashboard onLogout={handleLogout} />;
    }

    if (role === 'cliente' && clientData) {
        return <ClientPortal client={clientData} trabajos={clientTrabajos} onLogout={handleLogout} tallerInfo={tallerInfoForClient} />;
    }

    return <div className="flex h-screen items-center justify-center">Cargando portal...</div>;
};

export default App;