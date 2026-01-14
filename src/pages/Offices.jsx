// pages/Offices.jsx
import React, { useState, useEffect } from "react";
import { Pencil, Trash2, Plus, X, AlertTriangle, UserPlus, Target, Mail, Calendar, Users, Hash, Key, Building, User, Check } from "lucide-react";
import { fetchOffices, addOffice, updateOffice, deleteOffice } from "../lib/info.services";

const Offices = () => {
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 🔹 Add Office Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addData, setAddData] = useState({ 
    name: "", 
    officialName: "", 
    email: "", 
    role: "office",
    purposes: [],
    staffToVisit: []
  });
  const [newPurpose, setNewPurpose] = useState("");
  const [newStaff, setNewStaff] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // 🔹 Edit Modal
  const [editIndex, setEditIndex] = useState(null);
  const [editData, setEditData] = useState({ 
    id: "", 
    name: "", 
    officialName: "", 
    email: "", 
    role: "office",
    purposes: [],
    staffToVisit: []
  });
  const [editNewPurpose, setEditNewPurpose] = useState("");
  const [editNewStaff, setEditNewStaff] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // 🔹 Delete Modal
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  // 🔹 Helper function to convert to uppercase
  const toUppercase = (text) => {
    return text ? text.toUpperCase() : "";
  };

  // 🔹 Helper function to convert office name to email
  const generateEmailFromName = (name) => {
    if (!name.trim()) return "";
    
    let emailPart = name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '.')
      .replace(/\.+/g, '.')
      .replace(/^\.+|\.+$/g, '');
    
    if (!emailPart) {
      emailPart = "office";
    }
    
    return emailPart + "@gmail.com";
  };

  // 🔹 Helper function to handle office name change
  const handleAddNameChange = (value) => {
    const uppercaseName = toUppercase(value);
    const generatedEmail = generateEmailFromName(value);
    
    setAddData(prev => ({
      ...prev,
      name: uppercaseName,
      email: generatedEmail
    }));
  };

  // 🔹 Helper function to handle official office name change - PRESERVE ORIGINAL CASING
  const handleAddOfficialNameChange = (value) => {
    setAddData(prev => ({
      ...prev,
      officialName: value  // Keep original casing
    }));
  };

  // 🔹 Helper function to handle edit office name change
  const handleEditNameChange = (value) => {
    const uppercaseName = toUppercase(value);
    const generatedEmail = generateEmailFromName(value);
    
    setEditData(prev => ({
      ...prev,
      name: uppercaseName,
      email: generatedEmail
    }));
  };

  // 🔹 Helper function to handle edit official office name change - PRESERVE ORIGINAL CASING
  const handleEditOfficialNameChange = (value) => {
    setEditData(prev => ({
      ...prev,
      officialName: value  // Keep original casing
    }));
  };

  // 🔹 Helper function to handle purpose input with uppercase
  const handlePurposeInput = (value, isEdit = false) => {
    if (isEdit) {
      setEditNewPurpose(toUppercase(value));
    } else {
      setNewPurpose(toUppercase(value));
    }
  };

  // 🔹 Helper function to handle staff input with uppercase
  const handleStaffInput = (value, isEdit = false) => {
    if (isEdit) {
      setEditNewStaff(toUppercase(value));
    } else {
      setNewStaff(toUppercase(value));
    }
  };

  // 🔹 Load offices from Firestore (only on initial load)
  useEffect(() => {
    const loadOffices = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchOffices();
        console.log("Loaded offices data:", data);
        if (data.length > 0) {
          console.log("First office structure:", data[0]);
          console.log("First office officialName:", data[0].officialName);
        }
        setOffices(data);
      } catch (err) {
        console.error("Error loading offices:", err);
        setError(`Failed to load offices: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    loadOffices();
  }, []);

  // 🔹 Smart date formatter
  const formatDate = (timestamp) => {
    if (!timestamp) return "Just now";
    
    try {
      let date;
      
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp.seconds && typeof timestamp.seconds === 'number') {
        date = new Date(timestamp.seconds * 1000);
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else {
        date = new Date(timestamp);
      }
      
      if (!date || isNaN(date.getTime())) {
        return "Just now";
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return "Just now";
    }
  };

  // 🔹 Add purpose to list
  const addPurposeToList = () => {
    if (newPurpose.trim() === "") return;
    
    setAddData(prev => ({
      ...prev,
      purposes: [...prev.purposes, { 
        id: Date.now().toString(), 
        name: toUppercase(newPurpose.trim())
      }]
    }));
    setNewPurpose("");
  };

  // 🔹 Remove purpose from list
  const removePurposeFromList = (id) => {
    setAddData(prev => ({
      ...prev,
      purposes: prev.purposes.filter(purpose => purpose.id !== id)
    }));
  };

  // 🔹 Add staff to visit list
  const addStaffToList = () => {
    if (newStaff.trim() === "") return;
    
    setAddData(prev => ({
      ...prev,
      staffToVisit: [...prev.staffToVisit, { 
        id: Date.now().toString(), 
        name: toUppercase(newStaff.trim())
      }]
    }));
    setNewStaff("");
  };

  // 🔹 Remove staff from list
  const removeStaffFromList = (id) => {
    setAddData(prev => ({
      ...prev,
      staffToVisit: prev.staffToVisit.filter(staff => staff.id !== id)
    }));
  };

  // 🔹 Add purpose to edit list
  const addPurposeToEditList = () => {
    if (editNewPurpose.trim() === "") return;
    
    setEditData(prev => ({
      ...prev,
      purposes: [...prev.purposes, { 
        id: Date.now().toString(), 
        name: toUppercase(editNewPurpose.trim())
      }]
    }));
    setEditNewPurpose("");
  };

  // 🔹 Remove purpose from edit list
  const removePurposeFromEditList = (id) => {
    setEditData(prev => ({
      ...prev,
      purposes: prev.purposes.filter(purpose => purpose.id !== id)
    }));
  };

  // 🔹 Add staff to edit list
  const addStaffToEditList = () => {
    if (editNewStaff.trim() === "") return;
    
    setEditData(prev => ({
      ...prev,
      staffToVisit: [...prev.staffToVisit, { 
        id: Date.now().toString(), 
        name: toUppercase(editNewStaff.trim())
      }]
    }));
    setEditNewStaff("");
  };

  // 🔹 Remove staff from edit list
  const removeStaffFromEditList = (id) => {
    setEditData(prev => ({
      ...prev,
      staffToVisit: prev.staffToVisit.filter(staff => staff.id !== id)
    }));
  };

  // 🔹 OPTIMIZED: Add Office - Update local state immediately
  const saveAddOffice = async () => {
    if (!addData.name.trim()) {
      setAddError("Office name is required");
      return;
    }
    
    if (!addData.officialName.trim()) {
      setAddError("Official office name is required");
      return;
    }
    
    const emailExists = offices.some(office => 
      office.email && office.email.toLowerCase() === addData.email.toLowerCase()
    );
    
    if (emailExists) {
      setAddError("An office with this email already exists");
      return;
    }
    
    setAddLoading(true);
    setAddError("");
    
    try {
      // Generate default password based on role
      const defaultPassword = addData.role === "super" ? "superadmin2025" : "officeadmin2025";
      
      // Create temporary ID for immediate UI update
      const tempId = `temp_${Date.now()}`;
      
      // Create temporary office object for immediate display
      const tempOffice = {
        id: tempId,
        name: addData.name,
        officialName: addData.officialName, // Original casing preserved
        email: addData.email,
        role: addData.role,
        password: defaultPassword,
        purposes: addData.purposes,
        staffToVisit: addData.staffToVisit,
        createdAt: new Date()
      };
      
      // 🔹 OPTIMIZATION: Update local state immediately
      setOffices(prev => [...prev, tempOffice]);
      
      // Close modal immediately
      setShowAddModal(false);
      
      // Reset form
      setAddData({ 
        name: "", 
        officialName: "",
        email: "", 
        role: "office",
        purposes: [],
        staffToVisit: []
      });
      setNewPurpose("");
      setNewStaff("");
      
      // 🔹 OPTIMIZATION: Show success message immediately
      alert(`Office "${addData.name}" added successfully!`);
      
      // 🔹 OPTIMIZATION: Save to Firestore in background (non-blocking)
      setTimeout(async () => {
        try {
          // Log what's being sent to Firestore for debugging
          console.log("Saving to Firestore - officialName:", addData.officialName);
          
          const newOffice = await addOffice({
            ...addData,
            password: defaultPassword
          });
          
          // Update with real Firestore ID
          setOffices(prev => prev.map(office => 
            office.id === tempId 
              ? { ...newOffice, createdAt: newOffice.createdAt || new Date() }
              : office
          ));
          
          console.log(`✅ Office "${addData.name}" saved to Firestore`);
        } catch (err) {
          console.error("Error saving office to Firestore:", err);
          
          // Remove temporary office if Firestore save fails
          setOffices(prev => prev.filter(office => office.id !== tempId));
          
          // Show error alert
          alert(`Warning: Office "${addData.name}" was added locally but failed to save to database: ${err.message}`);
        }
      }, 0);
      
    } catch (err) {
      console.error("Error in add office process:", err);
      setAddError(`Failed to add office: ${err.message}`);
    } finally {
      setAddLoading(false);
    }
  };

  // 🔹 Open edit modal - FIXED: Added proper debugging and data extraction
  const openEditModal = (index) => {
    if (index >= 0 && index < offices.length) {
      const office = offices[index];
      
      console.log("Office object in edit modal:", office);
      console.log("Official name value:", office.officialName);
      console.log("All keys:", Object.keys(office));
      
      setEditIndex(index);
      setEditData({
        id: office.id,
        name: office.name || "",
        officialName: office.officialName || "", // Original casing preserved
        email: office.email || "",
        role: office.role || "office",
        purposes: office.purposes || [],
        staffToVisit: office.staffToVisit || []
      });
      setEditNewPurpose("");
      setEditNewStaff("");
      setEditError("");
    }
  };

  // 🔹 OPTIMIZED: Save edit - Update local state immediately
  const saveEdit = async () => {
    if (editIndex === null) return;
    
    if (!editData.name.trim()) {
      setEditError("Office name is required");
      return;
    }
    
    if (!editData.officialName.trim()) {
      setEditError("Official office name is required");
      return;
    }
    
    const emailExists = offices.some((office, index) => 
      index !== editIndex && 
      office.email && 
      office.email.toLowerCase() === editData.email.toLowerCase()
    );
    
    if (emailExists) {
      setEditError("An office with this email already exists");
      return;
    }
    
    setEditLoading(true);
    setEditError("");
    
    try {
      const originalOffice = offices[editIndex];
      
      // Create updated office object
      const updatedOffice = {
        id: editData.id,
        name: editData.name,
        officialName: editData.officialName, // Original casing preserved
        email: editData.email,
        role: editData.role,
        purposes: editData.purposes,
        staffToVisit: editData.staffToVisit,
        createdAt: originalOffice.createdAt,
        password: originalOffice.password
      };
      
      // 🔹 OPTIMIZATION: Update local state immediately
      const updatedOffices = [...offices];
      updatedOffices[editIndex] = updatedOffice;
      setOffices(updatedOffices);
      
      // Close modal immediately
      setEditIndex(null);
      
      // 🔹 OPTIMIZATION: Show success message immediately
      alert(`Office "${editData.name}" updated successfully!`);
      
      // 🔹 OPTIMIZATION: Save to Firestore in background (non-blocking)
      setTimeout(async () => {
        try {
          // Log what's being sent to Firestore for debugging
          console.log("Updating in Firestore - officialName:", editData.officialName);
          
          await updateOffice(updatedOffice);
          console.log(`✅ Office "${editData.name}" updated in Firestore`);
        } catch (err) {
          console.error("Error updating office in Firestore:", err);
          
          // Revert local changes if Firestore update fails
          const revertedOffices = [...offices];
          revertedOffices[editIndex] = originalOffice;
          setOffices(revertedOffices);
          
          // Show error alert
          alert(`Warning: Changes to "${editData.name}" were reverted due to database error: ${err.message}`);
        }
      }, 0);
      
    } catch (err) {
      console.error("Error in edit process:", err);
      setEditError(`Failed to update office: ${err.message}`);
    } finally {
      setEditLoading(false);
    }
  };

  // 🔹 Reset delete confirmation when modal closes
  useEffect(() => {
    if (deleteIndex === null) {
      setDeleteConfirmed(false);
    }
  }, [deleteIndex]);

  // 🔹 OPTIMIZED: Confirm delete - Update local state immediately
  const confirmDelete = async () => {
    if (deleteIndex === null || !deleteConfirmed) return;
    
    const officeToDelete = offices[deleteIndex];
    if (!officeToDelete || !officeToDelete.id) return;
    
    // Store original data for potential rollback
    const originalOffice = officeToDelete;
    
    setDeleteLoading(true);
    
    try {
      // 🔹 OPTIMIZATION: Update local state immediately
      const updatedOffices = offices.filter((_, i) => i !== deleteIndex);
      setOffices(updatedOffices);
      
      // Close modal immediately
      setDeleteIndex(null);
      setDeleteConfirmed(false);
      
      // 🔹 OPTIMIZATION: Show success message immediately
      alert(`Office "${officeToDelete.name}" deleted successfully!`);
      
      // 🔹 OPTIMIZATION: Delete from Firestore in background (non-blocking)
      setTimeout(async () => {
        try {
          await deleteOffice(officeToDelete.id);
          console.log(`✅ Office "${officeToDelete.name}" deleted from Firestore`);
        } catch (err) {
          console.error("Error deleting office from Firestore:", err);
          
          // Restore office if Firestore delete fails
          setOffices(prev => {
            const restored = [...prev];
            restored.splice(deleteIndex, 0, originalOffice);
            return restored;
          });
          
          // Show error alert
          alert(`Warning: "${officeToDelete.name}" was restored due to database error: ${err.message}`);
        }
      }, 0);
      
    } catch (err) {
      console.error("Error in delete process:", err);
      alert(`Failed to delete office: ${err.message}`);
      setDeleteLoading(false);
    }
  };

  // 🔹 Refresh offices list (only when explicitly needed)
  const refreshOffices = async () => {
    setLoading(true);
    try {
      const data = await fetchOffices();
      setOffices(data);
    } catch (err) {
      console.error("Error refreshing offices:", err);
      setError(`Failed to refresh: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Role badge styling - Minimalist version
  const getRoleBadge = (role) => {
    const isSuper = role === "super";
    return (
      <span className={`text-[10px] font-medium tracking-wider px-2 py-1 rounded-full border ${
        isSuper 
          ? "bg-purple-50 text-purple-700 border-purple-200" 
          : "bg-blue-50 text-blue-700 border-blue-200"
      }`}>
        {isSuper ? "SUPER ADMIN" : "OFFICE ADMIN"}
      </span>
    );
  };

  // 🔹 Enhanced render list items for purposes
  const renderPurposeList = (purposes, onRemove, isEdit = false) => (
    <div className="space-y-2">
      {purposes.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {purposes.map((purpose) => (
            <div 
              key={purpose.id} 
              className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 px-3 py-2 rounded-lg text-sm transition-all hover:scale-[1.02]"
            >
              <Target size={14} className="flex-shrink-0" />
              <span className="font-medium">{purpose.name}</span>
              <button
                type="button"
                onClick={() => onRemove(purpose.id)}
                className="ml-1 text-blue-400 hover:text-blue-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 border border-dashed border-gray-300 rounded-xl">
          <Target className="w-6 h-6 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No purposes added yet</p>
          <p className="text-xs text-gray-400 mt-1">Add purposes that visitors can select</p>
        </div>
      )}
    </div>
  );

  // 🔹 Enhanced render list items for staff
  const renderStaffList = (staffList, onRemove, isEdit = false) => (
    <div className="space-y-2">
      {staffList.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {staffList.map((staff) => (
            <div 
              key={staff.id} 
              className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-green-100 text-green-700 px-3 py-2 rounded-lg text-sm transition-all hover:scale-[1.02]"
            >
              <UserPlus size={14} className="flex-shrink-0" />
              <span className="font-medium">{staff.name}</span>
              <button
                type="button"
                onClick={() => onRemove(staff.id)}
                className="ml-1 text-green-400 hover:text-green-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 border border-dashed border-gray-300 rounded-xl">
          <UserPlus className="w-6 h-6 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No staff/instructors added yet</p>
          <p className="text-xs text-gray-400 mt-1">Add staff members visitors can request to see</p>
        </div>
      )}
    </div>
  );

  // 🔹 Enhanced Email display component
  const EmailDisplay = ({ email }) => {
    return (
      <div className="mt-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Mail className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-700">Auto-generated Email</div>
            <div className="text-xs text-gray-500">Based on office name</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-mono text-sm">
            {email || "office.name@gmail.com"}
          </div>
          {email && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(email);
                alert("Email copied to clipboard!");
              }}
              className="px-4 py-3 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all flex items-center gap-2"
              title="Copy email"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </button>
          )}
        </div>
      </div>
    );
  };

  // 🔹 Minimalist Stat Item Component
  const StatItem = ({ icon: Icon, label, value, color = "gray" }) => (
    <div className="flex items-center gap-2">
      <div className={`p-1.5 rounded-md bg-${color}-50`}>
        <Icon size={14} className={`text-${color}-600`} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="rounded-xl p-6 bg-white text-black border border-[#5B2D8B]">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-2xl font-bold mb-2">Office Accounts</h3>
            <p className="text-black/80">
              {loading ? "Loading..." : `${offices.length} office${offices.length !== 1 ? 's' : ''} registered`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setAddData({ 
                  name: "", 
                  officialName: "",
                  email: "", 
                  role: "office",
                  purposes: [],
                  staffToVisit: []
                });
                setShowAddModal(true);
              }}
              className="bg-purple-800 text-white hover:bg-purple-700 px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
              disabled={loading}
            >
              <Plus size={18} />
              Add Office
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="text-red-500 mr-3" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#7400EA] border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading offices...</p>
        </div>
      ) : offices.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
          <div className="w-16 h-16 bg-gradient-to-r from-[#7400EA]/10 to-[#5B2D8B]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Hash className="text-[#7400EA]" size={28} />
          </div>
          <h4 className="text-lg font-medium text-gray-700 mb-2">No offices found</h4>
          <p className="text-gray-500 mb-6">Add your first office account to get started</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#7400EA] to-[#5B2D8B] hover:from-[#5B2D8B] hover:to-[#4a2470] text-white px-5 py-2.5 rounded-lg transition-all duration-200 font-medium shadow-md hover:shadow-lg"
          >
            <Plus size={18} />
            Add Office
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {offices.map((office, index) => (
            <div 
              key={office.id} 
              className="bg-white rounded-2xl border border-gray-200 p-6 transition-all duration-300 hover:shadow-xl hover:border-[#7400EA]/20 group flex flex-col"
            >
              {/* Card Header with Role Badge */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#7400EA]/20 to-[#5B2D8B]/20 rounded-lg flex items-center justify-center">
                      <span className="text-lg font-bold text-[#7400EA]">
                        {office.name?.charAt(0).toUpperCase() || "O"}
                      </span>
                    </div>
                    {getRoleBadge(office.role)}
                  </div>
                  <h4 className="text-xl font-bold text-gray-800 group-hover:text-[#7400EA] transition-colors">
                    {office.name}
                  </h4>
                  {office.officialName && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {office.officialName}
                    </p>
                  )}
                </div>
                
                {/* Action Buttons - Minimal */}
                <div className="flex gap-1">
                  <button 
                    onClick={() => openEditModal(index)} 
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-[#7400EA]"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button 
                    onClick={() => setDeleteIndex(index)} 
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-500 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              {/* Office Info Stats - Minimal Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <StatItem 
                  icon={Mail} 
                  label="Email" 
                  value={office.email ? office.email.split('@')[0] : "N/A"} 
                  color="purple"
                />
                <StatItem 
                  icon={Calendar} 
                  label="Created" 
                  value={formatDate(office.createdAt)} 
                  color="blue"
                />
                {office.purposes?.length > 0 && (
                  <StatItem 
                    icon={Target} 
                    label="Purposes" 
                    value={office.purposes.length} 
                    color="green"
                  />
                )}
                {office.staffToVisit?.length > 0 && (
                  <StatItem 
                    icon={Users} 
                    label="Staff" 
                    value={office.staffToVisit.length} 
                    color="orange"
                  />
                )}
              </div>
              
              {/* Password Section - Now at the bottom */}
              {office.password && (
                <div className="mt-auto pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Password:</span>
                    <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">
                      {office.password}
                    </code>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 🔹 ADD MODAL - Modern Minimalist Design */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-[#7400EA] to-[#5B2D8B] text-white px-8 py-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Building size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Create New Office</h3>
                    <p className="text-white/80 text-sm mt-1">Add a new office account with custom settings</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)} 
                  className="p-2 hover:bg-white/10 rounded-xl transition-all"
                >
                  <X className="text-white" size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
              {addError && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="text-red-500" size={20} />
                    <p className="text-red-700 text-sm">{addError}</p>
                  </div>
                </div>
              )}
              
              <div className="space-y-8">
                {/* Basic Information */}
                <div className="bg-gray-50 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Building className="w-5 h-5 text-blue-600" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-800">Office Details</h4>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-3">
                        Office Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          value={addData.name}
                          onChange={(e) => handleAddNameChange(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:border-[#7400EA] focus:ring-2 focus:ring-[#7400EA]/20 transition-all uppercase"
                          placeholder="Enter office name"
                          disabled={addLoading}
                          style={{ textTransform: 'uppercase' }}
                        />
                        <div className="absolute right-3 top-3">
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">UPPERCASE</span>
                        </div>
                      </div>
                      <EmailDisplay email={addData.email} />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-3">
                        Official Office Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          value={addData.officialName}
                          onChange={(e) => handleAddOfficialNameChange(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:border-[#7400EA] focus:ring-2 focus:ring-[#7400EA]/20 transition-all"
                          placeholder="e.g., Office of the Registrar"
                          disabled={addLoading}
                        />
                        <div className="absolute right-3 top-3">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Full Name</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 ml-1">
                        The complete official department name
                      </p>
                    </div>
                  </div>
                </div>

                {/* User Role */}
                <div className="bg-gray-50 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Key className="w-5 h-5 text-purple-600" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-800">Access Level</h4>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className={`relative overflow-hidden rounded-xl border-2 transition-all cursor-pointer ${addData.role === "super" ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                        <input
                          type="radio"
                          checked={addData.role === "super"}
                          onChange={() => setAddData(prev => ({ ...prev, role: "super" }))}
                          className="sr-only"
                          disabled={addLoading}
                        />
                        <div className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${addData.role === "super" ? "bg-purple-100" : "bg-gray-100"}`}>
                                <User className={`w-4 h-4 ${addData.role === "super" ? "text-purple-600" : "text-gray-400"}`} />
                              </div>
                              <span className="font-semibold text-gray-800">Super Admin</span>
                            </div>
                            {addData.role === "super" && (
                              <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Password:</span>
                              <code className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">superadmin2025</code>
                            </div>
                            <p className="text-xs text-gray-500">Full system access and administration privileges</p>
                          </div>
                        </div>
                      </label>
                      
                      <label className={`relative overflow-hidden rounded-xl border-2 transition-all cursor-pointer ${addData.role === "office" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                        <input
                          type="radio"
                          checked={addData.role === "office"}
                          onChange={() => setAddData(prev => ({ ...prev, role: "office" }))}
                          className="sr-only"
                          disabled={addLoading}
                        />
                        <div className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${addData.role === "office" ? "bg-blue-100" : "bg-gray-100"}`}>
                                <Building className={`w-4 h-4 ${addData.role === "office" ? "text-blue-600" : "text-gray-400"}`} />
                              </div>
                              <span className="font-semibold text-gray-800">Office Admin</span>
                            </div>
                            {addData.role === "office" && (
                              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Password:</span>
                              <code className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">officeadmin2025</code>
                            </div>
                            <p className="text-xs text-gray-500">Limited to specific office functions and data</p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Purposes of Visit */}
                <div className="bg-gray-50 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Target className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800">Visit Purposes</h4>
                        <p className="text-sm text-gray-500">What visitors can select when visiting</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium bg-blue-100 text-blue-600 px-3 py-1 rounded-full">
                      {addData.purposes.length} added
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={newPurpose}
                          onChange={(e) => handlePurposeInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addPurposeToList()}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all uppercase"
                          placeholder="Add a purpose (e.g., MEETING, CONSULTATION)"
                          disabled={addLoading}
                          style={{ textTransform: 'uppercase' }}
                        />
                        <div className="absolute right-3 top-3">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">UPPERCASE</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addPurposeToList}
                        disabled={addLoading || !newPurpose.trim()}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                      >
                        <Plus size={18} />
                        Add
                      </button>
                    </div>
                    
                    {renderPurposeList(addData.purposes, removePurposeFromList)}
                    
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="p-1 bg-gray-100 rounded">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span>Press Enter or click Add to include multiple purposes</span>
                    </div>
                  </div>
                </div>

                {/* Staff/Instructors to Visit */}
                <div className="bg-gray-50 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <UserPlus className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800">Staff & Instructors</h4>
                        <p className="text-sm text-gray-500">Who visitors can request to meet</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium bg-green-100 text-green-600 px-3 py-1 rounded-full">
                      {addData.staffToVisit.length} added
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={newStaff}
                          onChange={(e) => handleStaffInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addStaffToList()}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all uppercase"
                          placeholder="Add staff/instructor name"
                          disabled={addLoading}
                          style={{ textTransform: 'uppercase' }}
                        />
                        <div className="absolute right-3 top-3">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">UPPERCASE</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addStaffToList}
                        disabled={addLoading || !newStaff.trim()}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                      >
                        <Plus size={18} />
                        Add
                      </button>
                    </div>
                    
                    {renderStaffList(addData.staffToVisit, removeStaffFromList)}
                    
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="p-1 bg-gray-100 rounded">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span>Add multiple staff members for visitor selection</span>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-6 border-t border-gray-200">
                  <button 
                    onClick={saveAddOffice} 
                    disabled={addLoading}
                    className="w-full bg-gradient-to-r from-[#7400EA] to-[#5B2D8B] hover:from-[#5B2D8B] hover:to-[#4a2470] text-white py-4 rounded-xl transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {addLoading ? (
                      <span className="flex items-center justify-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                        Creating Office Account...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-3">
                        <Plus size={20} />
                        CREATE OFFICE ACCOUNT
                        <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </span>
                    )}
                  </button>
                  <p className="text-center text-sm text-gray-500 mt-3">
                    Default password will be auto-generated based on selected role
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔹 EDIT MODAL - Modern Minimalist Design */}
      {editIndex !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Pencil size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Edit Office</h3>
                    <p className="text-white/80 text-sm mt-1">Update office details and preferences</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditIndex(null)} 
                  className="p-2 hover:bg-white/10 rounded-xl transition-all"
                >
                  <X className="text-white" size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
              {editError && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="text-red-500" size={20} />
                    <p className="text-red-700 text-sm">{editError}</p>
                  </div>
                </div>
              )}
              
              <div className="space-y-8">
                {/* Basic Information */}
                <div className="bg-gray-50 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Building className="w-5 h-5 text-blue-600" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-800">Office Details</h4>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-3">
                        Office Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          value={editData.name || ""}
                          onChange={(e) => handleEditNameChange(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all uppercase"
                          disabled={editLoading}
                          style={{ textTransform: 'uppercase' }}
                        />
                        <div className="absolute right-3 top-3">
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">UPPERCASE</span>
                        </div>
                      </div>
                      <EmailDisplay email={editData.email} />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-3">
                        Official Office Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          value={editData.officialName || ""}
                          onChange={(e) => handleEditOfficialNameChange(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                          placeholder="Enter official office name"
                          disabled={editLoading}
                        />
                        <div className="absolute right-3 top-3">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Full Name</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 ml-1">
                        The complete official department name
                      </p>
                    </div>
                  </div>
                </div>

                {/* User Role */}
                <div className="bg-gray-50 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Key className="w-5 h-5 text-purple-600" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-800">Access Level</h4>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className={`relative overflow-hidden rounded-xl border-2 transition-all cursor-pointer ${editData.role === "super" ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                        <input
                          type="radio"
                          checked={editData.role === "super"}
                          onChange={() => setEditData(prev => ({ ...prev, role: "super" }))}
                          className="sr-only"
                          disabled={editLoading}
                        />
                        <div className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${editData.role === "super" ? "bg-purple-100" : "bg-gray-100"}`}>
                                <User className={`w-4 h-4 ${editData.role === "super" ? "text-purple-600" : "text-gray-400"}`} />
                              </div>
                              <span className="font-semibold text-gray-800">Super Admin</span>
                            </div>
                            {editData.role === "super" && (
                              <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">Full system access and administration privileges</p>
                        </div>
                      </label>
                      
                      <label className={`relative overflow-hidden rounded-xl border-2 transition-all cursor-pointer ${editData.role === "office" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                        <input
                          type="radio"
                          checked={editData.role === "office"}
                          onChange={() => setEditData(prev => ({ ...prev, role: "office" }))}
                          className="sr-only"
                          disabled={editLoading}
                        />
                        <div className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${editData.role === "office" ? "bg-blue-100" : "bg-gray-100"}`}>
                                <Building className={`w-4 h-4 ${editData.role === "office" ? "text-blue-600" : "text-gray-400"}`} />
                              </div>
                              <span className="font-semibold text-gray-800">Office Admin</span>
                            </div>
                            {editData.role === "office" && (
                              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">Limited to specific office functions and data</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Purposes of Visit */}
                <div className="bg-gray-50 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Target className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800">Visit Purposes</h4>
                        <p className="text-sm text-gray-500">What visitors can select when visiting</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium bg-blue-100 text-blue-600 px-3 py-1 rounded-full">
                      {editData.purposes.length} added
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={editNewPurpose}
                          onChange={(e) => handlePurposeInput(e.target.value, true)}
                          onKeyPress={(e) => e.key === 'Enter' && addPurposeToEditList()}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all uppercase"
                          placeholder="Add a purpose"
                          disabled={editLoading}
                          style={{ textTransform: 'uppercase' }}
                        />
                        <div className="absolute right-3 top-3">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">UPPERCASE</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addPurposeToEditList}
                        disabled={editLoading || !editNewPurpose.trim()}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                      >
                        <Plus size={18} />
                        Add
                      </button>
                    </div>
                    
                    {renderPurposeList(editData.purposes, removePurposeFromEditList, true)}
                  </div>
                </div>

                {/* Staff/Instructors to Visit */}
                <div className="bg-gray-50 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <UserPlus className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800">Staff & Instructors</h4>
                        <p className="text-sm text-gray-500">Who visitors can request to meet</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium bg-green-100 text-green-600 px-3 py-1 rounded-full">
                      {editData.staffToVisit.length} added
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={editNewStaff}
                          onChange={(e) => handleStaffInput(e.target.value, true)}
                          onKeyPress={(e) => e.key === 'Enter' && addStaffToEditList()}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all uppercase"
                          placeholder="Add staff/instructor name"
                          disabled={editLoading}
                          style={{ textTransform: 'uppercase' }}
                        />
                        <div className="absolute right-3 top-3">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">UPPERCASE</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addStaffToEditList}
                        disabled={editLoading || !editNewStaff.trim()}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                      >
                        <Plus size={18} />
                        Add
                      </button>
                    </div>
                    
                    {renderStaffList(editData.staffToVisit, removeStaffFromEditList, true)}
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-6 border-t border-gray-200">
                  <button 
                    onClick={saveEdit} 
                    disabled={editLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 rounded-xl transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {editLoading ? (
                      <span className="flex items-center justify-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                        Saving Changes...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-3">
                        <Check size={20} />
                        UPDATE OFFICE
                        <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔹 DELETE MODAL */}
      {deleteIndex !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-xl">
            {/* Modal Header */}
            <div className="bg-red-50 p-6 text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="text-red-600" size={28} />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Delete Office Account</h3>
              <p className="text-gray-600">This action cannot be undone</p>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center mb-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-purple-600 font-bold text-lg">
                      {offices[deleteIndex]?.name?.charAt(0).toUpperCase() || "O"}
                    </span>
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-gray-800">{offices[deleteIndex]?.name}</h4>
                    <p className="text-sm text-gray-600">{offices[deleteIndex]?.email}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white p-2 rounded border text-center">
                    <div className="text-gray-500">Role</div>
                    <div className="font-medium">{getRoleBadge(offices[deleteIndex]?.role)}</div>
                  </div>
                  <div className="bg-white p-2 rounded border text-center">
                    <div className="text-gray-500">Created</div>
                    <div className="font-medium">{formatDate(offices[deleteIndex]?.createdAt)}</div>
                  </div>
                </div>
              </div>

              {/* Warning Message */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 mb-1">Important Warning</p>
                    <p className="text-sm text-yellow-700">
                      All data associated with this office account will be permanently deleted. 
                      This includes any documents, files, or records created by this user.
                    </p>
                  </div>
                </div>
              </div>

              {/* Extra Confirmation for Safety */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={deleteConfirmed}
                    onChange={(e) => setDeleteConfirmed(e.target.checked)}
                    className="h-5 w-5 text-red-600 rounded border-gray-300 mr-3 focus:ring-red-500 focus:ring-offset-0"
                  />
                  <div>
                    <p className="font-medium text-gray-800">I confirm I want to delete this account</p>
                    <p className="text-sm text-gray-600 mt-1">
                      I understand this action is permanent and cannot be undone
                    </p>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setDeleteIndex(null);
                    setDeleteConfirmed(false);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition duration-200 flex items-center justify-center gap-2"
                  disabled={deleteLoading}
                >
                  <X size={18} />
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete} 
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium rounded-lg transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={deleteLoading || !deleteConfirmed}
                >
                  {deleteLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      Delete Account
                    </>
                  )}
                </button>
              </div>
            </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Offices;