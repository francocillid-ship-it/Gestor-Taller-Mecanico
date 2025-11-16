import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import Login from './components/Login';
import TallerDashboard from './components/TallerDashboard';
import ClientPortal from './components/ClientPortal';
import ResetPassword from './components/ResetPassword';
import SetInitialPassword from './components/SetInitialPassword';
import type { Cliente, Trabajo, TallerInfo } from './types';

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
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type');

        if (type === 'recovery') {
            setAuthAction('PASSWORD_RECOVERY');
        } else if (type === 'invite') {
            setAuthAction('SET_INITIAL_PASSWORD');
        }
        
        if (type) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }, []);

    useEffect(() => {
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (_event === 'SIGNED_OUT') {
                setAuthAction('APP');
                setRole(null);
                setUser(null);
                setClientData(null);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        const processSession = async () => {
            setLoading(true);
            
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
                const tallerInfo = currentUser.user_metadata?.taller_info_ref || null;
                const tallerName = tallerInfo?.nombre || currentUser.user_metadata?.taller_nombre_ref || 'Mi Taller';
                setTallerInfoForClient({ ...tallerInfo, nombre: tallerName });

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

                        const { data: trabajosData, error: trabajosError } = await supabase
                            .from('trabajos')
                            .select('*')
                            .eq('cliente_id', currentUser.id)
                            .order('fecha_entrada', { ascending: false });
                        
                        if (trabajosError) throw trabajosError;
                        
                        const finalTrabajos = (trabajosData || []).map(t => ({
                            id: t.id,
                            clienteId: t.cliente_id,
                            vehiculoId: t.vehiculo_id,
                            descripcion: t.descripcion,
                            partes: t.partes,
                            costoManoDeObra: t.costo_mano_de_obra,
                            costoEstimado: t.costo_estimado,
                            status: t.status,
                            fechaEntrada: t.fecha_entrada,
                            fechaSalida: t.fecha_salida,
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
        supabase.auth.signOut();
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
