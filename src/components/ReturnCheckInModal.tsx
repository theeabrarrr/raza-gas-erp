"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface TripMetric {
    trip_id: string;
    driver_name: string;
    start_time: string;
    end_time: string | null;
    completed_orders_count: number;
    expected_empty_returns: number;
}

interface TripCylinder {
    cylinder_id: string;
    serial_number: string;
    size: string;
    current_status: string;
    return_status: string; // Ensure string type to match state init
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
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
    const [cylinders, setCylinders] = useState<TripCylinder[]>([]);
    const [processing, setProcessing] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        if (isOpen) {
            fetchTripMetrics();
            setSelectedTripId(null);
            setCylinders([]);
        }
    }, [isOpen]);

    const fetchTripMetrics = async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc("get_trip_return_metrics");
        if (error) {
            console.error("Error fetching metrics:", error);
            toast.error("Failed to load active trips.");
        } else {
            setTrips(data || []);
        }
        setLoading(false);
    };

    const handleSelectTrip = async (tripId: string) => {
        setSelectedTripId(tripId);
        setLoading(true);
        const { data, error } = await supabase.rpc("get_trip_cylinders", {
            p_trip_id: tripId,
        });

        if (error) {
            toast.error("Failed to fetch cylinders");
            setSelectedTripId(null);
        } else {
            const mapped = (data || []).map((c: any) => ({
                ...c,
                return_status: 'empty'
            }));
            setCylinders(mapped);
        }
        setLoading(false);
    };

    const updateCylinderStatus = (id: string, status: string) => {
        setCylinders(prev => prev.map(c =>
            c.cylinder_id === id ? { ...c, return_status: status } : c
        ));
    };

    const handleFinalizeReturn = async () => {
        if (!selectedTripId) return;
        setProcessing(true);

        const payload = cylinders.map(c => ({
            id: c.cylinder_id,
            status: c.return_status
        }));

        try {
            const { data, error } = await supabase.rpc("process_trip_returns", {
                p_trip_id: selectedTripId,
                p_returned_items: payload
            });

            if (error) throw error;

            toast.success(`Processed ${data.cylinders_processed} cylinders.`);
            setSelectedTripId(null);
            fetchTripMetrics();
        } catch (err: any) {
            toast.error(`Error: ${err.message}`);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                <div className="p-6 pb-0 flex-shrink-0">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span className="bg-emerald-100 p-1.5 rounded-lg">
                                <RefreshCw className="w-5 h-5 text-emerald-600" />
                            </span>
                            {selectedTripId ? "Verify Return Items" : "Return Check-in"}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedTripId
                                ? "Select the condition of each returned cylinder"
                                : "Verify empty cylinders returned by drivers"}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground animate-in fade-in">
                            <Loader2 className="w-8 h-8 animate-spin mb-4" />
                            <p>Loading...</p>
                        </div>
                    ) : selectedTripId ? (
                        // RECONCILIATION VIEW
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold text-foreground">Cylinders Expected ({cylinders.length})</h3>
                                <Button
                                    variant="link"
                                    onClick={() => setSelectedTripId(null)}
                                    className="text-muted-foreground hover:text-foreground p-0 h-auto font-normal"
                                >
                                    Back to Trips
                                </Button>
                            </div>

                            {cylinders.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-muted/30">
                                    <p>No cylinders found for this trip's orders.</p>
                                </div>
                            ) : (
                                <div className="border rounded-md overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-muted/50 border-b">
                                            <tr>
                                                <th className="p-4 font-medium text-muted-foreground">Serial</th>
                                                <th className="p-4 font-medium text-muted-foreground">Size</th>
                                                <th className="p-4 font-medium text-muted-foreground">Condition</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {cylinders.map((cyl) => (
                                                <tr key={cyl.cylinder_id} className="group hover:bg-muted/30 transition-colors">
                                                    <td className="p-4 font-mono text-foreground font-medium">{cyl.serial_number}</td>
                                                    <td className="p-4 text-muted-foreground">{cyl.size}</td>
                                                    <td className="p-3">
                                                        <Select
                                                            value={cyl.return_status}
                                                            onValueChange={(val) => updateCylinderStatus(cyl.cylinder_id, val)}
                                                        >
                                                            <SelectTrigger className="h-9 w-[150px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="empty">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-2 h-2 rounded-full bg-emerald-500" /> Empty
                                                                    </div>
                                                                </SelectItem>
                                                                <SelectItem value="full">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-2 h-2 rounded-full bg-blue-500" /> Full (Return)
                                                                    </div>
                                                                </SelectItem>
                                                                <SelectItem value="defective">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-2 h-2 rounded-full bg-rose-500" /> Defective
                                                                    </div>
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        // TRIP LIST VIEW
                        trips.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed rounded-xl bg-muted/30">
                                <CheckCircle className="w-12 h-12 mb-4 text-muted-foreground/50" />
                                <p>No pending returns found</p>
                            </div>
                        ) : (
                            <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-muted/50 border-b">
                                        <tr>
                                            <th className="p-4 font-medium text-muted-foreground">Driver</th>
                                            <th className="p-4 font-medium text-muted-foreground">Start Time</th>
                                            <th className="p-4 font-medium text-center text-muted-foreground">Delivered</th>
                                            <th className="p-4 font-medium text-center text-muted-foreground">Expected</th>
                                            <th className="p-4 font-medium text-right text-muted-foreground">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {trips.map((trip) => (
                                            <tr
                                                key={trip.trip_id}
                                                className="group hover:bg-muted/30 transition-colors"
                                            >
                                                <td className="p-4 font-medium text-foreground">
                                                    <div className="flex items-center gap-2">
                                                        {trip.driver_name}
                                                        {!trip.end_time && (
                                                            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-muted-foreground">
                                                    {new Date(trip.start_time).toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </td>
                                                <td className="p-4 text-center font-medium">{trip.completed_orders_count}</td>
                                                <td className="p-4 text-center">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                        {trip.expected_empty_returns}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleSelectTrip(trip.trip_id)}
                                                    >
                                                        Process
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>

                {/* Footer Area for Actions */}
                {selectedTripId && (
                    <div className="p-6 pt-2 border-t mt-auto bg-muted/20 flex justify-end gap-3 flex-shrink-0">
                        <Button
                            variant="outline"
                            onClick={() => setSelectedTripId(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleFinalizeReturn}
                            disabled={processing || cylinders.length === 0}
                            className={cn(processing && "opacity-80")}
                        >
                            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm & Restock
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
