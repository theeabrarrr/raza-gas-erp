"use client";

import {
  Truck,
  Wallet,
  X,
  UploadCloud,
  MapPin,
  CheckCircle,
  Smartphone,
  Users,
  Clock,
  AlertTriangle,
  Power,
  LogOut
} from "lucide-react";
import { isShiftTime, canBypassShift } from "@/lib/shifts";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// Mock Location ID needed for Stock Deduction
let DEFAULT_LOCATION_ID = "";

export default function DriverPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );

  const [currentTrip, setCurrentTrip] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [deliveryStep, setDeliveryStep] = useState<"payment" | "success">(
    "payment",
  );
  const [deliveryProof, setDeliveryProof] = useState<File | null>(null);
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);
  const [deliverySummary, setDeliverySummary] = useState({
    delivered: 0,
    collected: 0,
  });
  const [receivedAmount, setReceivedAmount] = useState("");

  // Wallet State
  const [walletBalance, setWalletBalance] = useState(0);

  // Expense Form State
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("fuel");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseFile, setExpenseFile] = useState<File | null>(null);
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Delivery Form State
  const [cylinderSerials, setCylinderSerials] = useState("");

  // Handover Form State (New)
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverAmount, setHandoverAmount] = useState("");
  const [handoverReceiver, setHandoverReceiver] = useState("");
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [handingOver, setHandingOver] = useState(false);

  // Shift State
  const [isOnline, setIsOnline] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Force Timer Update
  const [now, setNow] = useState(new Date());

  // Logout Logic
  const handleLogout = async () => {
    toast.promise(supabase.auth.signOut(), {
      loading: 'Logging out...',
      success: () => {
        window.location.href = '/login';
        return 'Logged out successfully';
      },
      error: 'Error logging out',
    });
  };

  useEffect(() => {
    fetchDrivers();
    fetchDefaultLocation();
    fetchCashiers();

    // Timer Interval
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedDriverId) {
      fetchDeliveries();
      checkActiveTrip();
      fetchWallet(); // NEW: Fetch Wallet
      setSelectedOrderIds(new Set()); // Reset selection

      // Realtime Subscription for Driver
      const channel = supabase
        .channel(`driver-orders-${selectedDriverId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `driver_id=eq.${selectedDriverId}`, // Only listen for THIS driver
          },
          (payload) => {
            console.log("Realtime Update:", payload);
            fetchDeliveries();
            checkActiveTrip(); // Re-check trip status too
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedDriverId]);

  async function fetchCashiers() {
    // Same logic as Recovery Page
    const { data } = await supabase
      .from("users")
      .select("id, name, role")
      .in("role", ["admin", "shop_manager", "cashier"]);
    setCashiers(data || []);
  }

  async function fetchDrivers() {
    // 1. Get ALL drivers for selection (Admin/Debug view)
    const { data } = await supabase
      .from("users")
      .select("id, name, role, shift, is_online")
      .ilike("role", "%driver%");
    if (data && data.length > 0) {
      setDrivers(data);
      // Default to first driver IF not already selected
      if (!selectedDriverId) setSelectedDriverId(data[0].id);

      // 2. Hydrate Profile for Selected Driver
      const current = data.find(d => d.id === (selectedDriverId || data[0].id));
      if (current) {
        setUserProfile(current);
        setIsOnline(current.is_online || false);
      }
    }
  }

  // Effect to update profile when selection changes
  useEffect(() => {
    if (selectedDriverId && drivers.length > 0) {
      const current = drivers.find(d => d.id === selectedDriverId);
      if (current) {
        setUserProfile(current);
        setIsOnline(current.is_online || false);
      }
    }
  }, [selectedDriverId, drivers]);

  async function fetchDefaultLocation() {
    const { data } = await supabase
      .from("locations")
      .select("id")
      .limit(1)
      .single();
    if (data) DEFAULT_LOCATION_ID = data.id;
  }

  async function checkActiveTrip() {
    if (!selectedDriverId) return;
    try {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .eq("driver_id", selectedDriverId)
        .eq("status", "ongoing")
        .single();

      if (data) setCurrentTrip(data);
      else setCurrentTrip(null);
    } catch (error) {
      setCurrentTrip(null);
    }
  }

  async function fetchDeliveries() {
    if (!selectedDriverId) return;
    setLoading(true);
    console.log("Fetching orders for Driver ID:", selectedDriverId);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, customers(name, address, phone), order_items(product_name, quantity)",
        )
        .eq("driver_id", selectedDriverId)
        .in("status", [
          "pending",
          "assigned",
          "dispatched",
          "delivering",
          "on-the-road",
          "on_trip",
        ]);

      console.log("Supabase Order Response:", { data, error });

      if (error) throw error;
      setDeliveries(data || []);

      if (data) {
        const ongoing = data.filter(
          (o) => o.status === "on-the-road" || o.status === "delivering",
        );
        if (ongoing.length > 0) {
          // Optionally lock selection? For now just reflect reality
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchWallet() {
    if (!selectedDriverId) return;
    const { data } = await supabase
      .from("employee_wallets")
      .select("balance")
      .eq("user_id", selectedDriverId)
      .single();
    if (data) {
      setWalletBalance(data.balance);
    } else {
      // If no wallet exists, create one with 0 (Lazy Init)
      await supabase
        .from("employee_wallets")
        .insert([{ user_id: selectedDriverId, balance: 0 }]);
      setWalletBalance(0);
    }
  }

  const toggleShift = async () => {
    if (!userProfile) return;

    // 1. Check Shift Time Rules (if turning ON)
    if (!isOnline) {
      const allowed = isShiftTime(userProfile.shift) || canBypassShift(userProfile.role);

      if (!allowed) {
        toast.error(`Outside Shift Hours! Your shift is: ${userProfile.shift}`);
        return;
      }
    }

    // 2. Toggle Status in DB
    const newStatus = !isOnline;
    const { error } = await supabase
      .from('users')
      .update({ is_online: newStatus })
      .eq('id', selectedDriverId);

    if (error) {
      toast.error('Failed to update status');
    } else {
      setIsOnline(newStatus);
      // Update local cache
      const updatedDrivers = drivers.map(d => d.id === selectedDriverId ? { ...d, is_online: newStatus } : d);
      setDrivers(updatedDrivers);
      toast.success(newStatus ? "Shift Started 🟢" : "Shift Ended 🔴");
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    // Only allow selection if ONLINE or Role Bypass
    if (!isOnline && !canBypassShift(userProfile?.role)) {
      toast.error("Please START SHIFT to process orders.");
      return;
    }

    const newSet = new Set(selectedOrderIds);
    if (newSet.has(orderId)) {
      newSet.delete(orderId);
    } else {
      newSet.add(orderId);
    }
    setSelectedOrderIds(newSet);
  };

  const handleTripAction = async () => {
    if (!selectedDriverId) return;

    if (currentTrip) {
      // END TRIP
      const { error } = await supabase
        .from("trips")
        .update({ status: "completed", end_time: new Date().toISOString() })
        .eq("id", currentTrip.id);

      if (error) {
        toast.error("Failed to end trip");
        return;
      }

      // Reset Driver Status
      await supabase
        .from("users")
        .update({ status: "idle" })
        .eq("id", selectedDriverId);

      setCurrentTrip(null);
      toast.success("Trip Ended Successfully");

      // FIX: Clear Selection and Refetch to prevent stale state
      setSelectedOrderIds(new Set());
      fetchDeliveries();
    } else {
      // START TRIP - requires selection
      if (selectedOrderIds.size === 0) {
        toast.error("Select at least one order to start trip!");
        return;
      }

      // DEFENSIVE CHECK: Prevent starting trip with already delivered orders
      const selectedOrdersList = deliveries.filter((d) =>
        selectedOrderIds.has(d.id),
      );
      if (selectedOrdersList.some((o) => o.status === "delivered")) {
        toast.error(
          "Error: Cannot start trip. One or more orders are already delivered.",
        );
        return;
      }

      const { data, error } = await supabase
        .from("trips")
        .insert([
          {
            driver_id: selectedDriverId,
            start_time: new Date().toISOString(),
            status: "ongoing",
          },
        ])
        .select()
        .single();

      if (error) {
        toast.error("Failed to start trip");
        return;
      }
      setCurrentTrip(data);

      // Set Driver Status to Busy
      await supabase
        .from("users")
        .update({ status: "busy" })
        .eq("id", selectedDriverId);

      // Update ONLY SELECTED Orders to On-The-Road
      const selectedOrders = Array.from(selectedOrderIds);

      // Line 184 Fix: Rename to tripData and tripError to avoid conflict
      const { data: tripData, error: tripError } = await supabase
        .from("orders")
        .update({
          status: "on_trip", // STRICT: Database Constraint
          trip_started_at: new Date().toISOString(),
        })
        .in("id", selectedOrders)
        .select();

      if (tripError) {
        toast.error(`DB ERROR: ${tripError.message}`);
        return;
      }
      if (!tripData || tripData.length === 0) {
        toast.warning("No rows updated. Check if IDs are correct.");
      } else {
        toast.success("Trip Started Successfully!");
        fetchDeliveries();
      }
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverId) return;

    if (!expenseFile) {
      toast.error("Receipt Photo is Mandatory!");
      return;
    }

    setSubmittingExpense(true);

    try {
      const fileExt = expenseFile.name.split(".").pop();
      const fileName = `${selectedDriverId}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(filePath, expenseFile);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("receipts").getPublicUrl(filePath);

      // Save
      const { error: dbError } = await supabase.from("expenses").insert([
        {
          user_id: selectedDriverId,
          amount: parseFloat(expenseAmount),
          category: expenseCategory,
          description: expenseDesc,
          proof_url: publicUrl,
          approved: false,
        },
      ]);

      if (dbError) throw dbError;

      toast.success("Expense Saved Successfully");
      setShowExpenseModal(false);
      setExpenseAmount("");
      setExpenseDesc("");
      setExpenseCategory("fuel");
      setExpenseFile(null);
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    } finally {
      setSubmittingExpense(false);
    }
  };

  const openDeliveryModal = (order: any) => {
    setSelectedOrder(order);
    setDeliveryStep("payment");
    setCylinderSerials(""); // Reset input
    setDeliveryProof(null);
    setReceivedAmount(order.total_amount?.toString() || ""); // Auto-fill with total
    setShowDeliveryModal(true);
  };

  const handleDeliverySubmit = async () => {
    // No method arg
    // Determine Location ID (Order specific or Default)
    const locationId = selectedOrder?.location_id || DEFAULT_LOCATION_ID;

    if (!selectedOrder || !locationId || !selectedDriverId) {
      toast.error("System Error: No Location or Driver Found (Check Console)");
      console.error("Missing Data:", {
        order: selectedOrder?.id,
        driver: selectedDriverId,
        loc: locationId,
      });
      return;
    }

    // Logic for Partial Payment
    const received = parseFloat(receivedAmount);
    if (isNaN(received) || received < 0) {
      toast.error("Please enter a valid amount received.");
      return;
    }

    // Determine Method: 'Cash' ONLY if fully paid. Else 'Credit'.
    // If received == 0 -> 'Credit' (Full Credit)
    // If received < total -> 'Credit' (Partial Credit)
    // If received >= total -> 'Cash' (Full Payment)
    const total = selectedOrder.total_amount || 0;
    const method = received >= total ? "cash" : "credit";
    const balance = Math.max(0, total - received);

    // If fully unpaid (0 received), proof might not be needed?
    // BUT User said: "Transaction (Cash Log): amount = amount_received".
    // If amount is > 0, we likely want proof (cash collected).
    if (received > 0 && !deliveryProof) {
      toast.error(
        "Please upload a proof of payment/delivery (photo) for cash collected!",
      );
      return;
    }

    setIsSubmittingDelivery(true);
    const toastId = toast.loading("Processing Delivery...");

    try {
      let proofUrl = null;

      // 1. Upload Proof if exists
      if (deliveryProof) {
        const fileExt = deliveryProof.name.split(".").pop();
        const fileName = `proof_${selectedOrder.id}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("receipts")
          .upload(fileName, deliveryProof);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("receipts").getPublicUrl(fileName);

        proofUrl = publicUrl;
      }

      // 2. Update Order Status
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          status: "completed",
          payment_method: method,
          amount_received: received, // NEW COLUMN
          trip_completed_at: new Date().toISOString(),
          notes: cylinderSerials, // Save Serial Numbers
        })
        .eq("id", selectedOrder.id);

      if (orderError) throw orderError;

      // 3. Handle Payment Logic (Transaction + Wallet + Debt)
      console.log(
        "Payment Logic Triggered. Received:",
        received,
        "Method:",
        method,
      );

      // A) Cash Collected -> Transaction + Driver Wallet
      if (received > 0) {
        // Log Transaction
        const { error: txnError } = await supabase.from("transactions").insert([
          {
            order_id: selectedOrder.id,
            location_id: locationId,
            customer_id: selectedOrder.customer_id,
            user_id: selectedDriverId, // Driver
            amount: received, // CASH COLLECTED
            type: "sale",
            payment_method: "cash",
            proof_url: proofUrl,
          },
        ]);
        if (txnError) console.error("Transaction Insert Error:", txnError);

        // Update Driver Wallet
        console.log("Updating Wallet for Driver:", selectedDriverId);
        const { data: walletData, error: fetchErr } = await supabase
          .from("employee_wallets")
          .select("balance")
          .eq("user_id", selectedDriverId)
          .single();
        if (fetchErr) console.error("Wallet Fetch Error:", fetchErr);

        const currentBal = walletData?.balance || 0;
        const newWalletBal = currentBal + received;
        console.log("Current Bal:", currentBal, "New Bal:", newWalletBal);

        const { error: walletError } = await supabase
          .from("employee_wallets")
          .upsert({
            user_id: selectedDriverId,
            balance: newWalletBal,
            updated_at: new Date().toISOString(),
          });

        if (walletError) {
          console.error("Wallet Update Failed:", walletError);
          toast.error("Warning: Wallet update failed.");
        } else {
          console.log("Wallet Updated Successfully");
          fetchWallet(); // Update UI
        }
      }

      // B) Remaining Balance -> Customer Debt
      if (balance > 0) {
        console.log("Updating Debt by:", balance);
        const { data: cust } = await supabase
          .from("customers")
          .select("current_balance")
          .eq("id", selectedOrder.customer_id)
          .single();
        const newDebt = (cust?.current_balance || 0) + balance;
        await supabase
          .from("customers")
          .update({ current_balance: newDebt })
          .eq("id", selectedOrder.customer_id);
      }

      // 4. Inventory Deduction (Legacy - can be kept or removed if we rely purely on serialized tracking)
      for (const item of selectedOrder.order_items) {
        // Decrement Full, Increment Empty (Logic kept for simple counts)
        const { data: inv } = await supabase
          .from("inventory")
          .select("*")
          .eq("location_id", locationId)
          .limit(1)
          .single();
        if (inv) {
          await supabase
            .from("inventory")
            .update({
              count_full: inv.count_full - item.quantity,
              count_empty: inv.count_empty + item.quantity,
            })
            .eq("id", inv.id);
        }
      }

      // 5. SWAP LOGIC: Update Serialized Assets
      // A) Full Cylinders: Move from Driver -> Customer
      const { error: fullUpdateError } = await supabase
        .from("cylinders")
        .update({
          current_location_type: "customer",
          current_holder_id: selectedOrder.customer_id,
          status: "full", // EXPLICITLY SET STATUS TO FULL
          updated_at: new Date().toISOString(),
        })
        .eq("last_order_id", selectedOrder.id)
        .eq("current_location_type", "driver"); // Only those currently with driver

      if (fullUpdateError)
        console.error("Full Update Failed:", fullUpdateError);

      // B) Empty Returns: Move from Customer -> Driver
      const returnedSerials = cylinderSerials
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s);
      let returnedCount = 0;

      if (returnedSerials.length > 0) {
        const { data: returnedData, error: emptyUpdateError } = await supabase
          .from("cylinders")
          .update({
            status: "empty",
            current_location_type: "driver",
            current_holder_id: selectedDriverId,
            last_order_id: selectedOrder.id, // Link for Trip Reconciliation
            updated_at: new Date().toISOString(),
          })
          .in("serial_number", returnedSerials)
          .select();

        if (emptyUpdateError) {
          toast.error(`Return Error: ${emptyUpdateError.message}`);
        } else {
          returnedCount = returnedData?.length || 0;
        }
      }

      toast.dismiss(toastId);

      // Check for remaining active orders in the CURRENT batch
      const remainingOrdersCount = deliveries.filter(
        (o) =>
          o.id !== selectedOrder.id &&
          o.driver_id === selectedDriverId &&
          (o.status === "on_trip" ||
            (o.status === "assigned" && o.trip_started_at)),
      ).length;

      if (remainingOrdersCount === 0 && currentTrip) {
        // Auto-End Trip
        const { error: tripError } = await supabase
          .from("trips")
          .update({ status: "completed", end_time: new Date().toISOString() })
          .eq("id", currentTrip.id);

        if (!tripError) {
          // Reset Driver Status
          await supabase
            .from("users")
            .update({ status: "idle" })
            .eq("id", selectedDriverId);

          setCurrentTrip(null);
          toast.success("All deliveries completed. Trip Ended.");
        } else {
          toast.success("Delivery Completed (Trip End Failed)");
        }
      } else {
        toast.success(
          `delivered ${selectedOrder.order_items[0]?.quantity || 1} Full, Collected ${returnedCount} Empty!`,
        );
      }

      setDeliverySummary({
        delivered: selectedOrder.order_items[0]?.quantity || 1,
        collected: returnedCount,
      });
      setDeliveryStep("success"); // Show WhatsApp screen
      // Store returned count for display if needed, or rely on toast

      // FIX: Clear Selection and Refetch
      setSelectedOrderIds(new Set());
      fetchDeliveries(); // Refresh list
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error(`Error: ${error.message}`);
      console.error(error);
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  const handleHandoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(handoverAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount");
      return;
    }
    if (!handoverReceiver) {
      toast.error("Select a receiver");
      return;
    }

    setHandingOver(true);
    try {
      // Fetch receiver name for log
      const receiverName =
        cashiers.find((c) => c.id === handoverReceiver)?.name || "Unknown";

      // Insert into Handover Logs (Pending)
      const { error: logError } = await supabase.from("handover_logs").insert([
        {
          sender_id: selectedDriverId,
          receiver_id: handoverReceiver,
          amount: amount,
          status: "pending",
        },
      ]);

      if (logError) throw logError;

      // Deduct from Wallet (It's now "in transit" / pending verification, so removed from driver's active balance?)
      // YES, User Request: "deducts from their current_balance (Transit state)"
      const { data: walletData } = await supabase
        .from("employee_wallets")
        .select("balance")
        .eq("user_id", selectedDriverId)
        .single();
      const currentBal = walletData?.balance || 0;
      await supabase
        .from("employee_wallets")
        .upsert({
          user_id: selectedDriverId,
          balance: currentBal - amount,
          updated_at: new Date().toISOString(),
        });

      // Activity Log
      await supabase.from("activity_logs").insert([
        {
          user_id: selectedDriverId, // The driver handing over
          action_text: `Handed over Rs ${amount.toLocaleString()} to ${receiverName}(Pending Verification)`,
        },
      ]);

      toast.success(`Handover of Rs ${amount} recorded! Balance Updated.`);
      fetchWallet(); // Update UI
      setShowHandoverModal(false);
      setHandoverAmount("");
    } catch (error: any) {
      toast.error(`Handover Failed: ${error.message}`);
    } finally {
      setHandingOver(false);
    }
  };

  // Timer Helper
  const getElapsedTime = (startTime: string) => {
    const start = new Date(startTime).getTime();
    const current = now.getTime();
    const diff = Math.max(0, current - start);

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, "0")}: ${minutes.toString().padStart(2, "0")}: ${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen pb-32 flex flex-col gap-6 font-sans">
      {/* HEADER: Added for Logout */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
            <Truck size={20} />
          </div>
          <div>
            <h1 className="font-black text-gray-900 leading-none uppercase">Driver App</h1>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mt-0.5">Raza Gas ERP</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-50 text-red-600 p-2.5 rounded-xl border border-red-100 hover:bg-red-100 active:scale-95 transition-all"
          title="Log Out"
        >
          <LogOut size={20} />
        </button>
      </div>

      {/* DRIVER SELECTOR (HIDDEN FOR PRODUCTION, visible if debug needed) */}
      {/* <div className="bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700 hidden"> ... </div> */}

      {/* 1. Wallet Balance & Handover Card (Hero) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-start">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">
              Cash in Hand
            </p>
            <div className="flex gap-2">
              <button
                onClick={toggleShift}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all ${isOnline
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-500 border-slate-200"
                  }`}
              >
                <Power size={14} /> {isOnline ? 'ON DUTY' : 'OFF DUTY'}
              </button>
              <button
                onClick={() => setShowExpenseModal(true)}
                className="px-3 py-1.5 bg-gray-50 text-gray-600 text-xs font-bold rounded-lg border border-gray-200 flex items-center gap-1 hover:bg-gray-100 transition-colors"
              >
                <Wallet size={14} /> Expense
              </button>
            </div>
          </div>

          <div className="text-4xl font-black text-gray-900 mb-6 mt-1">
            Rs {(walletBalance || 0).toLocaleString()}
          </div>

          <div className="border-t border-gray-100 my-4"></div>

          <button
            onClick={() => setShowHandoverModal(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-emerald-500/20"
          >
            <CheckCircle size={20} /> Request Handover
          </button>
        </div>
      </div>

      {/* 2. Trip Action Card (Replaces Footer) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        {(() => {
          const hasActiveDeliveries = deliveries.some(
            (d) => d.status === "on_trip" || d.status === "on-the-road",
          );
          const canEndTrip = currentTrip && !hasActiveDeliveries;

          return currentTrip ? (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4 bg-emerald-50 py-2 rounded-lg border border-emerald-100">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  Trip Active • {getElapsedTime(currentTrip.start_time)}
                </span>
              </div>

              <button
                onClick={handleTripAction}
                disabled={!canEndTrip}
                className={`w-full py-4 rounded-xl font-bold text-lg uppercase tracking-wide shadow-lg transition-all active:scale-95 ${canEndTrip
                  ? "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
              >
                {hasActiveDeliveries ? "Delivering..." : "End Trip"}
              </button>
              {!canEndTrip && (
                <p className="text-xs text-gray-400 mt-2 font-medium">Complete all active deliveries to end trip</p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm font-medium text-gray-400 mb-4">Select orders below to start</p>
              <button
                onClick={handleTripAction}
                disabled={selectedOrderIds.size === 0}
                className={`w-full py-4 rounded-xl font-bold text-lg uppercase tracking-wide shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${selectedOrderIds.size > 0
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/30"
                  : "bg-gray-100 text-gray-300 cursor-not-allowed"
                  }`}
              >
                <Truck size={24} />
                Start Trip {selectedOrderIds.size > 0 && `(${selectedOrderIds.size})`}
              </button>
            </div>
          );
        })()}
      </div>

      {/* 3. Active Deliveries Section */}
      <div className="w-full">
        <div className="flex justify-between items-center mb-4 px-1">
          <h2 className="text-lg font-bold text-gray-800">
            Active Deliveries
          </h2>
          <span className="text-sm bg-white border border-gray-200 text-gray-600 px-2.5 py-0.5 rounded-lg font-bold">
            {deliveries.length}
          </span>
        </div>

        {deliveries.length === 0 ? (
          <div className="py-12 px-6 text-center bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mx-auto mb-4">
              <CheckCircle size={32} />
            </div>
            <h3 className="text-gray-900 font-bold text-lg mb-1">All Caught Up!</h3>
            <p className="text-gray-400 text-sm">
              No pending deliveries assigned to you.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {deliveries.map((order) => (
              <div
                key={order.id}
                onClick={() => {
                  if (
                    !currentTrip &&
                    ["pending", "assigned", "dispatched"].includes(order.status)
                  ) {
                    toggleOrderSelection(order.id);
                  } else if (
                    order.status === "on_trip" ||
                    order.status === "on-the-road"
                  ) {
                    openDeliveryModal(order);
                  }
                }}
                className={`bg-white p-5 rounded-xl shadow-sm border transition-all relative ${selectedOrderIds.has(order.id)
                  ? "border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/10"
                  : order.status === "on_trip" ||
                    order.status === "on-the-road"
                    ? "border-amber-400 ring-2 ring-amber-500/10"
                    : "border-gray-100"
                  }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-start gap-4">
                    {/* Checkbox for Selection - Only for pending/assigned/dispatched */}
                    {!currentTrip &&
                      ["pending", "assigned", "dispatched"].includes(
                        order.status,
                      ) && (
                        <div className="mt-1">
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedOrderIds.has(order.id) ? "bg-emerald-500 border-emerald-500" : "border-gray-300"}`}>
                            {selectedOrderIds.has(order.id) && <CheckCircle size={14} className="text-white" />}
                          </div>
                        </div>
                      )}
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg leading-tight">
                        {order.customers?.name}
                      </h3>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-1">
                        #{order.readable_id || order.id.slice(0, 6)}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {order.status === "on_trip" ||
                    order.status === "on-the-road" ? (
                    <div className="flex flex-col items-end">
                      <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider block">
                        On Route
                      </span>
                    </div>
                  ) : (
                    <span
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${selectedOrderIds.has(order.id) ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {order.status}
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-2 text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <MapPin size={16} className="text-gray-400 shrink-0 mt-0.5" />
                  <span className="font-medium leading-snug">{order.customers?.address || "No Address Provided"}</span>
                </div>

                <div className="bg-gray-50/50 p-3 rounded-xl text-sm text-gray-600 mb-2 border border-gray-100">
                  {order.order_items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between mb-1 last:mb-0">
                      <span className="font-medium text-gray-700">
                        {item.product_name}
                      </span>
                      <span className="font-bold text-gray-900">
                        x{item.quantity}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-bold text-gray-900">
                    <span>Total</span>
                    <span>Rs {order.total_amount.toLocaleString()}</span>
                  </div>
                </div>

                {/* Complete Delivery Button - Visible and Clickable */}
                {(order.status === "on_trip" ||
                  order.status === "on-the-road") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeliveryModal(order);
                      }}
                      className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={18} />
                      Complete Delivery
                    </button>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expense Modal (Unchanged) */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowExpenseModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"
            >
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold mb-6 text-gray-900">
              New Expense
            </h2>
            <form onSubmit={handleSaveExpense} className="space-y-4">
              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-xl p-4 text-center hover:bg-gray-100 transition-colors relative">
                <input type="file" accept="image/*" onChange={(e) => setExpenseFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <UploadCloud size={32} />
                  <span className="text-sm font-bold text-gray-900">{expenseFile ? expenseFile.name : "Tap to Upload Receipt *"}</span>
                </div>
              </div>

              {/* Inputs */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Amount</label>
                <input type="number" required placeholder="0.00" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} className="w-full p-4 bg-gray-50 text-gray-900 border border-gray-300 rounded-xl text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Category</label>
                <select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} className="w-full p-4 bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="fuel">Fuel</option>
                  <option value="vehicle_maint">Maintenance</option>
                  <option value="staff_food">Food</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Description</label>
                <textarea rows={2} placeholder="Details..." value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} className="w-full p-4 bg-gray-50 text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <button type="submit" disabled={submittingExpense} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-lg mt-2 shadow-md disabled:opacity-50">
                {submittingExpense ? "Uploading..." : "Save Expense"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delivery Modal (Existing Wrapper) */}
      {showDeliveryModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          {/* Reusing existing Delivery Modal Internal Logic, just ensuring wrapper aligns */}
          {/* Copying the EXACT internal structure from previous steps to ensure no functionality loss */}
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button onClick={() => setShowDeliveryModal(false)} className="absolute top-4 right-4 text-gray-400"><X size={24} /></button>

            {deliveryStep === "payment" ? (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Complete Delivery</h2>
                <div className="bg-gray-50 p-4 rounded-xl mb-6 text-center border border-gray-200">
                  <span className="text-xs font-bold text-gray-400 uppercase">Amount Due</span>
                  <div className="text-3xl font-black text-gray-900">Rs {selectedOrder.total_amount.toLocaleString()}</div>
                </div>

                {/* Cylinder Serials */}
                <div className="mb-4">
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Returned Empty Serials</label>
                  <input type="text" placeholder="e.g. RG-005" value={cylinderSerials} onChange={(e) => setCylinderSerials(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none uppercase text-gray-900" />
                </div>

                {/* Proof */}
                <div className="mb-6">
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Proof</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 bg-gray-50 text-center relative hover:bg-gray-100">
                    <input type="file" accept="image/*" onChange={(e) => setDeliveryProof(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <div className="flex flex-col items-center gap-1 text-gray-500"><UploadCloud size={24} /><span className="text-sm font-bold">{deliveryProof ? deliveryProof.name : "Tap to Upload"}</span></div>
                  </div>
                </div>

                {/* Amount Received */}
                <div className="mb-4">
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Received (Rs)</label>
                  <input type="number" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-300 rounded-xl text-3xl font-black text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0" />
                </div>

                <button onClick={handleDeliverySubmit} disabled={isSubmittingDelivery} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50">
                  {isSubmittingDelivery ? "Processing..." : "Confirm & Complete"}
                </button>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4"><CheckCircle size={32} /></div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
                <p className="text-gray-500 mb-6">Order Completed.</p>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 grid grid-cols-2 gap-4">
                  <div className="text-center"><span className="text-xs font-bold text-emerald-600 uppercase block mb-1">Delivered</span><span className="text-2xl font-black text-gray-900">{deliverySummary.delivered}</span></div>
                  <div className="text-center border-l border-gray-200"><span className="text-xs font-bold text-gray-500 uppercase block mb-1">Empties</span><span className="text-2xl font-black text-gray-900">{deliverySummary.collected}</span></div>
                </div>

                <button onClick={() => {
                  const invoiceUrl = `${window.location.origin}/invoice/${selectedOrder.id}`;
                  const text = `Salam ${selectedOrder.customers?.name}, Your order is delivered! 🚛%0A%0A📄 Invoice: ${invoiceUrl}%0A💰 Total: Rs ${selectedOrder.total_amount.toLocaleString()}%0A%0AThank you!`;
                  window.open(`https://wa.me/${selectedOrder.customers?.phone}?text=${text}`, "_blank");
                  setShowDeliveryModal(false);
                }} className="w-full bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2">
                  <Smartphone size={24} /> Share Invoice
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Handover Modal (Existing Wrapper) */}
      {showHandoverModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          {/* ... Keep existing logic ... */}
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm relative animate-in fade-in zoom-in duration-200">
            <button onClick={() => setShowHandoverModal(false)} className="absolute top-4 right-4 text-gray-400"><X size={24} /></button>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Handover Cash</h2>
            <p className="text-sm text-gray-500 mb-6">Transfer cash to Head Office</p>
            <form onSubmit={handleHandoverSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Amount</label>
                <input type="number" autoFocus required value={handoverAmount} onChange={(e) => setHandoverAmount(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-300 rounded-xl text-3xl font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Receiver</label>
                <select required value={handoverReceiver} onChange={(e) => setHandoverReceiver(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 outline-none text-gray-900">
                  <option value="">Select Receiver...</option>
                  {cashiers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.role === "cashier" ? "Cashier" : c.role})</option>)}
                </select>
              </div>
              <button type="submit" disabled={handingOver} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50">
                {handingOver ? "Recording..." : "Record Handover"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
