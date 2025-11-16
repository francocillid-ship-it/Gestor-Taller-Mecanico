import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import Login from './components/Login';
import TallerDashboard from './components/TallerDashboard';
import ClientPortal from './components/ClientPortal';
import ResetPassword from './components/ResetPassword';
import SetInitialPassword from './components/SetInitialPassword';
import type { Cliente, Trabajo } from './types';

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [authView, setAuthView] = useState<'APP' | 'PASSWORD_RECOVERY' | 'SET_INITIAL_PASSWORD'>('APP');

    // Client-specific state
    const [clientData, setClientData] = useState<Cliente | null>(null);
    const [clientTrabajos, setClientTrabajos] = useState<Trabajo[]>([]);
    const [tallerName, setTallerName] = useState('Mi Taller');

    useEffect(() => {
        setLoading(true);
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const type = hashParams.get('type');

            // Absolute Priority: Handle special flows from URL and then stop processing this event.
            if (type === 'recovery' || type === 'invite') {
                if (type === 'recovery') {
                    setAuthView('PASSWORD_RECOVERY');
                } else { // type === 'invite'
                    setAuthView('SET_INITIAL_PASSWORD');
                }
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
                
                // Clean up the URL so refreshes don't re-trigger this logic.
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
                
                // CRITICAL: Stop further processing for this auth event to prevent race condition.
                return;
            }

            // A secondary trigger for recovery is the event itself, in case the hash is already gone.
            if (_event === 'PASSWORD_RECOVERY') {
                setAuthView('PASSWORD_RECOVERY');
                setSession(session);
                setLoading(false);
                return;
            }
            
            // Default: Normal App View. This only runs if we are not in a special flow.
            setAuthView('APP');
            setSession(session);
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            const userRole = currentUser?.user_metadata?.role || null;
            setRole(userRole);

            if (userRole === 'cliente') {
                setTallerName(currentUser?.user_metadata?.taller_nombre_ref || 'Mi Taller');
            }

            if (_event === 'SIGNED_OUT') {
                setClientData(null);
            }
            
            setLoading(false);
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        const fetchClientData = async () => {
            if (user && role === 'cliente') {
                setLoading(true);
                try {
                    // Fetch client profile
                    const { data: clientProfile, error: clientError } = await supabase
                        .from('clientes')
                        .select('*')
                        .eq('id', user.id)
                        .single();

                    if (clientError) throw clientError;

                    // Fetch client's vehicles
                    const { data: vehiculos, error: vehiculosError } = await supabase
                        .from('vehiculos')
                        .select('*')
                        .eq('cliente_id', user.id);
                    if (vehiculosError) throw vehiculosError;
                    
                    const fullClientData = { ...clientProfile, vehiculos: vehiculos || [] };
                    setClientData(fullClientData as any);

                    // Fetch jobs for this client
                    const { data: trabajosData, error: trabajosError } = await supabase
                        .from('trabajos')
                        .select('*')
                        .eq('cliente_id', user.id)
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

                } catch (error: any) {
                    console.error("Error fetching client data: ", error.message);
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchClientData();
    }, [user, role]);
    
    const handleLogout = async () => {
        await supabase.auth.signOut();
    };
    
    const handleAuthSuccess = () => {
        window.history.replaceState(null, '', window.location.pathname);
        supabase.auth.signOut();
        setAuthView('APP');
        setSession(null);
    };

    if (authView === 'SET_INITIAL_PASSWORD') {
        return <SetInitialPassword onSetSuccess={handleAuthSuccess} />;
    }

    if (authView === 'PASSWORD_RECOVERY') {
        return <ResetPassword onResetSuccess={handleAuthSuccess} />;
    }
    
    if (loading) {
        return <div className="flex h-screen items-center justify-center">Cargando...</div>;
    }
    
    if (!session) {
        return <Login />;
    }

    if (role === 'taller') {
        return <TallerDashboard onLogout={handleLogout} />;
    }

    if (role === 'cliente' && clientData) {
        return <ClientPortal client={clientData} trabajos={clientTrabajos} onLogout={handleLogout} tallerName={tallerName} />;
    }

    // Still loading client data or role is not set
    return <div className="flex h-screen items-center justify-center">Cargando portal...</div>;
};

export default App;