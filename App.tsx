import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import Login from './components/Login';
import TallerDashboard from './components/TallerDashboard';
import ClientPortal from './components/ClientPortal';
import ResetPassword from './components/ResetPassword';
import type { Cliente, Trabajo } from './types';

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [authView, setAuthView] = useState<'APP' | 'PASSWORD_RECOVERY'>('APP');

    // Client-specific state
    const [clientData, setClientData] = useState<Cliente | null>(null);
    const [clientTrabajos, setClientTrabajos] = useState<Trabajo[]>([]);
    const [tallerName, setTallerName] = useState('Mi Taller');

    useEffect(() => {
        setLoading(true);
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            // The 'PASSWORD_RECOVERY' event fires when the user lands on the page
            // from the email link. It provides a temporary session.
            if (_event === 'PASSWORD_RECOVERY') {
                setAuthView('PASSWORD_RECOVERY');
            } else {
                setSession(session);
                setUser(session?.user ?? null);
                const userRole = session?.user?.user_metadata?.role || null;
                setRole(userRole);
                if (userRole === 'cliente') {
                    setTallerName(session?.user?.user_metadata?.taller_nombre_ref || 'Mi Taller');
                }

                if (_event === 'SIGNED_OUT') {
                    setClientData(null);
                    setAuthView('APP'); // Go back to normal app view on sign out
                }
            }
            setLoading(false);
        });

        // Fallback check for hash on initial load, in case the event is missed.
        if (window.location.hash.includes('type=recovery')) {
            setAuthView('PASSWORD_RECOVERY');
        }


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
    
    const handleResetSuccess = () => {
        window.history.replaceState(null, '', window.location.pathname);
        supabase.auth.signOut();
        setAuthView('APP');
        setSession(null);
    };

    if (authView === 'PASSWORD_RECOVERY') {
        return <ResetPassword onResetSuccess={handleResetSuccess} />;
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
