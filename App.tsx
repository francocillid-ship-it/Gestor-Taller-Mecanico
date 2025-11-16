import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import Login from './components/Login';
import TallerDashboard from './components/TallerDashboard';
import ClientPortal from './components/ClientPortal';
import ResetPassword from './components/ResetPassword';
import SetInitialPassword from './components/SetInitialPassword';
import type { Cliente, Trabajo } from './types';

type AuthAction = 'APP' | 'PASSWORD_RECOVERY' | 'SET_INITIAL_PASSWORD';

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    
    // This state is the key. It's set ONCE from the URL and only cleared on success/logout.
    const [authAction, setAuthAction] = useState<AuthAction>('APP');

    // Client-specific state
    const [clientData, setClientData] = useState<Cliente | null>(null);
    const [clientTrabajos, setClientTrabajos] = useState<Trabajo[]>([]);
    const [tallerName, setTallerName] = useState('Mi Taller');

    // Effect 1: Runs only ONCE on mount to detect the initial auth action from the URL.
    useEffect(() => {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type');

        if (type === 'recovery') {
            setAuthAction('PASSWORD_RECOVERY');
        } else if (type === 'invite') {
            setAuthAction('SET_INITIAL_PASSWORD');
        }
        
        // After checking, clean the URL to prevent re-triggering on refresh during the flow.
        if (type) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }, []); // Empty dependency array ensures this runs only once.

    // Effect 2: Handles ongoing session changes from Supabase.
    useEffect(() => {
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            // If the user logs out while in a special flow, reset the flow.
            if (_event === 'SIGNED_OUT') {
                setAuthAction('APP');
                setRole(null);
                setUser(null);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    // Effect 3: Derives user/role from the session, BUT respects the authAction.
    useEffect(() => {
        setLoading(true);

        if (authAction !== 'APP') {
            // If we are in a special flow (recovery/invite), we don't need role or client data.
            // Just set the user from the session and mark loading as complete for these views.
            setUser(session?.user ?? null);
            setRole(null);
            setClientData(null);
            setLoading(false);
            return;
        }

        // --- This is the logic for the normal app flow ---
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        const userRole = currentUser?.user_metadata?.role || null;
        setRole(userRole);

        if (userRole === 'cliente') {
            setTallerName(currentUser?.user_metadata?.taller_nombre_ref || 'Mi Taller');
        } else {
            // If not a client (or no session), we are done loading.
            setLoading(false);
        }

        if (!session) {
            setClientData(null);
        }

    }, [session, authAction]);

    // Effect 4: Fetches client-specific data ONLY when we have a client user in the normal app flow.
    useEffect(() => {
        const fetchClientData = async () => {
            if (!user) return;
            setLoading(true);
            try {
                // Fetch client profile
                const { data: clientProfile, error: clientError } = await supabase
                    .from('clientes')
                    .select('*, vehiculos(*)')
                    .eq('id', user.id)
                    .single();
                if (clientError) throw clientError;
                setClientData(clientProfile as any);

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
        };

        if (user && role === 'cliente' && authAction === 'APP') {
            fetchClientData();
        }
    }, [user, role, authAction]);
    
    const handleLogout = async () => {
        await supabase.auth.signOut();
    };
    
    const handleAuthSuccess = () => {
        // Called from password screens. Signs user out and resets flow to 'APP'.
        // The user will see a success message and then be presented with the Login screen.
        supabase.auth.signOut();
        setAuthAction('APP');
    };

    if (loading && authAction === 'APP') {
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
        return <ClientPortal client={clientData} trabajos={clientTrabajos} onLogout={handleLogout} tallerName={tallerName} />;
    }

    // Fallback loading screen, e.g., while clientData is being fetched.
    return <div className="flex h-screen items-center justify-center">Cargando portal...</div>;
};

export default App;
