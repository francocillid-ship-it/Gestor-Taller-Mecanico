import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import Login from './components/Login';
import TallerDashboard from './components/TallerDashboard';
import ClientPortal from './components/ClientPortal';
import type { Cliente, Trabajo } from './types';

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Client-specific state
    const [clientData, setClientData] = useState<Cliente | null>(null);
    const [clientTrabajos, setClientTrabajos] = useState<Trabajo[]>([]);
    const [tallerName, setTallerName] = useState('Mi Taller');

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();
                setRole(profile?.role || null);
            }
            setLoading(false);
        };
        
        getSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                 const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();
                setRole(profile?.role || null);
            } else {
                setRole(null);
            }
            if (_event === 'SIGNED_OUT') {
                setClientData(null);
            }
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
                    // Fetch client profile and their workshop's name
                    const { data: clientProfile, error: clientError } = await supabase
                        .from('clientes')
                        .select('*, talleres ( nombre )')
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
                    setTallerName((clientProfile as any)?.talleres?.nombre || 'Mi Taller');

                    // Fetch jobs for this client
                    const { data: trabajosData, error: trabajosError } = await supabase
                        .from('trabajos')
                        .select('*')
                        .eq('cliente_id', user.id)
                        .order('fecha_entrada', { ascending: false });
                    if (trabajosError) throw trabajosError;

                    // Map snake_case to camelCase
                    const mappedTrabajos = trabajosData.map(t => ({
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

                    setClientTrabajos(mappedTrabajos || []);

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
    
    if (loading && !session) {
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