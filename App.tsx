import React, { useState, useMemo, useEffect } from 'react';
import type { UserRole, Cliente, Gasto, Trabajo } from './types';
import { JobStatus } from './types';
import Login from './components/Login';
import TallerDashboard from './components/TallerDashboard';
import ClientPortal from './components/ClientPortal';
import { supabase } from './supabaseClient';
import type { TallerInfo } from './components/TallerDashboard';
import type { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
    const [gastos, setGastos] = useState<Gasto[]>([]);
    const [tallerInfo, setTallerInfo] = useState<TallerInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setLoading(false);
        };
        getSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
            }
        );

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!session) {
                setUserRole(null);
                return;
            };

            setLoading(true);
            try {
                // Fetch user role from profiles table
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();
                
                if (profileError) throw profileError;

                const role = profile.role as UserRole;
                setUserRole(role);

                // Fetch all data in parallel
                const [
                    { data: clientesData, error: clientesError },
                    { data: trabajosData, error: trabajosError },
                    { data: gastosData, error: gastosError },
                    { data: tallerInfoData, error: tallerInfoError },
                ] = await Promise.all([
                    supabase.from('clientes').select('*, vehiculos(*)'),
                    supabase.from('trabajos').select('*, partes(*)'),
                    supabase.from('gastos').select('*').order('fecha', { ascending: false }),
                    supabase.from('taller_info').select('*').limit(1).single(),
                ]);

                if (clientesError) throw clientesError;
                if (trabajosError) throw trabajosError;
                if (gastosError) throw gastosError;
                if (tallerInfoError) throw tallerInfoError;

                setClientes(clientesData || []);
                setTrabajos(trabajosData || []);
                setGastos(gastosData || []);
                setTallerInfo(tallerInfoData);

            } catch (error) {
                console.error("Error fetching data from Supabase:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [session]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUserRole(null);
        setClientes([]);
        setTrabajos([]);
        setGastos([]);
    };

    const addGasto = async (gasto: Omit<Gasto, 'id' | 'fecha'>) => {
        const newGasto: Omit<Gasto, 'id'> = {
            ...gasto,
            fecha: new Date().toISOString().split('T')[0],
        };
        
        const { data, error } = await supabase
            .from('gastos')
            .insert(newGasto)
            .select()
            .single();

        if (error) {
            console.error("Error adding gasto:", error);
        } else if(data) {
            setGastos(prev => [data, ...prev]);
        }
    };
    
    const updateTrabajoStatus = async (trabajoId: string, newStatus: JobStatus) => {
        const { data, error } = await supabase
            .from('trabajos')
            .update({ status: newStatus })
            .eq('id', trabajoId)
            .select('*, partes(*)')
            .single();
        
        if (error) {
            console.error("Error updating trabajo:", error);
        } else if (data) {
            setTrabajos(prevTrabajos => 
                prevTrabajos.map(t => 
                    t.id === trabajoId ? data : t
                )
            );
        }
    };

    const updateTallerInfo = async (newInfo: TallerInfo) => {
        const { data, error } = await supabase
            .from('taller_info')
            .update({
                nombre: newInfo.nombre,
                direccion: newInfo.direccion,
                logo_url: newInfo.logoUrl,
                telefono: newInfo.telefono,
                cuit: newInfo.cuit,
            })
            .eq('id', 1)
            .select()
            .single();

        if (error) {
            console.error("Error updating taller info:", error);
        } else if (data) {
            setTallerInfo(data);
        }
    };


    const clientData = useMemo(() => {
        if (userRole === 'cliente') {
            // In a real app, you might fetch only this client's data
            // based on the logged-in user's ID.
            const client = clientes[0];
            if (!client) return null;
            const clientTrabajos = trabajos.filter(t => t.clienteId === client.id);
            return { client, trabajos: clientTrabajos };
        }
        return null;
    }, [userRole, clientes, trabajos]);

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center min-h-screen">
                    <p className="text-xl">Cargando...</p>
                </div>
            );
        }

        if (!session || !userRole) {
            return <Login />;
        }
        if (userRole === 'taller' && tallerInfo) {
            return (
                <TallerDashboard
                    clientes={clientes}
                    trabajos={trabajos}
                    gastos={gastos}
                    onLogout={handleLogout}
                    onAddGasto={addGasto}
                    onUpdateTrabajoStatus={updateTrabajoStatus}
                    tallerInfo={tallerInfo}
                    onUpdateTallerInfo={updateTallerInfo}
                />
            );
        }
        if (userRole === 'cliente' && clientData && tallerInfo) {
            return (
                <ClientPortal
                    client={clientData.client}
                    trabajos={clientData.trabajos}
                    onLogout={handleLogout}
                    tallerName={tallerInfo.nombre}
                />
            );
        }
        return <Login />;
    };

    return (
      <div className="min-h-screen bg-taller-light">
        {renderContent()}
      </div>
    );
};

export default App;