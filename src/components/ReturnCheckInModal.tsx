"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface TripMetric {
    trip_id: string;
    driver_name: string;
    start_time: string;
    end_time: string | null;
    completed_orders_count: number;
    expected_empty_returns: number;
}

export default function ReturnCheckInModal({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const [trips, setTrips] = useState<TripMetric[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchTripMetrics();
        }
    }, [isOpen]);

    const fetchTripMetrics = async () => {
        setLoading(true);
        // Call the RPC function we created in the migration
        const { data, error } = await supabase.rpc("get_trip_return_metrics");
        if (error) {
            console.error("Error fetching metrics:", error);
            toast.error("Failed to load active trips.");
        } else {
            setTrips(data || []);
        }
        setLoading(false);
    };

    const handleConfirmReturn = async (tripId: string) => {
        setProcessingId(tripId);
        try {
            const { data, error } = await supabase.rpc("process_trip_returns", {
                p_trip_id: tripId,
            });

            if (error) throw error;

            toast.success(
                `Success! ${data.cylinders_returned} cylinders moved to Warehouse.`,
            );
            // Refresh list
            fetchTripMetrics();
        } catch (err: any) {
            toast.error(`Error processing return: ${err.message}`);
        } finally {
            setProcessingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <RefreshCw className="text-emerald-400" /> Return Check-in
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">
                            Verify empty cylinders returned by drivers
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {loading ? (
                        <div className="text-center py-12 text-slate-400 animate-pulse">
                            Loading active trips...
                        </div>
                    ) : trips.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <CheckCircle className="mx-auto mb-3 text-slate-300" size={48} />
                            <p>No pending returns found.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="pb-3 pl-2">Driver</th>
                                        <th className="pb-3">Trip Start</th>
                                        <th className="pb-3 text-center">Delivered</th>
                                        <th className="pb-3 text-center">Expected Returns</th>
                                        <th className="pb-3 text-right pr-2">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {trips.map((trip) => (
                                        <tr
                                            key={trip.trip_id}
                                            className="group hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                                        >
                                            <td className="py-4 pl-2 font-medium text-slate-900">
                                                {trip.driver_name}
                                                {trip.end_time ? (
                                                    <span className="ml-2 text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                                                        Ended
                                                    </span>
                                                ) : (
                                                    <span className="ml-2 text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full animate-pulse">
                                                        Active
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 text-slate-500">
                                                {new Date(trip.start_time).toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </td>
                                            <td className="py-4 text-center font-semibold text-slate-700">
                                                {trip.completed_orders_count}
                                            </td>
                                            <td className="py-4 text-center">
                                                <span className="bg-orange-50 text-orange-700 font-bold px-3 py-1 rounded-lg border border-orange-100">
                                                    {trip.expected_empty_returns}
                                                </span>
                                            </td>
                                            <td className="py-4 text-right pr-2">
                                                <button
                                                    onClick={() => handleConfirmReturn(trip.trip_id)}
                                                    disabled={processingId === trip.trip_id}
                                                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {processingId === trip.trip_id
                                                        ? "Saving..."
                                                        : "Confirm Return"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-4 text-center text-xs text-gray-400 border-t border-gray-100">
                    Confirming moves cylinders to Warehouse as 'Empty'
                </div>
            </div>
        </div>
    );
}
