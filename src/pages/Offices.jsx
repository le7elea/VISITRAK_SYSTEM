// pages/Offices.jsx
import React, { useState, useEffect } from "react";
import { Pencil, Trash2, Plus, X, AlertTriangle } from "lucide-react";
import { fetchOffices, addOffice, updateOffice, deleteOffice } from "../lib/info.services";

const Offices = () => {
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 🔹 Add Office Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addData, setAddData] = useState({ 
    name: "", 
    email: "", 
    role: "office" 
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // 🔹 Edit Modal
  const [editIndex, setEditIndex] = useState(null);
  const [editData, setEditData] = useState({ 
    id: "", 
    name: "", 
    email: "", 
    role: "office" 
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // 🔹 Delete Modal
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  // 🔹 Load offices from Firestore
  useEffect(() => {
    const loadOffices = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchOffices();
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

  // 🔹 Smart date formatter - handles all cases
  const formatDate = (timestamp) => {
    if (!timestamp) return "Just now";
    
    try {
      let date;
      
      // Case 1: Firestore Timestamp object with toDate()
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } 
      // Case 2: Firestore timestamp format {seconds, nanoseconds}
      else if (timestamp.seconds && typeof timestamp.seconds === 'number') {
        date = new Date(timestamp.seconds * 1000);
      }
      // Case 3: Already a Date object
      else if (timestamp instanceof Date) {
        date = timestamp;
      }
      // Case 4: String or number
      else {
        date = new Date(timestamp);
      }
      
      // Check if valid date
      if (!date || isNaN(date.getTime())) {
        return "Just now";
      }
      
      // Return formatted date
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return "Just now";
    }
  };

  // 🔹 Add Office with proper date handling
  const saveAddOffice = async () => {
    if (!addData.name.trim()) {
      setAddError("Office name is required");
      return;
    }
    
    if (!addData.email.trim()) {
      setAddError("Email is required");
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(addData.email)) {
      setAddError("Please enter a valid email address");
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
      // Add office to Firestore
      const newOffice = await addOffice(addData);
      
      // 🔹 FIX: Add current date for immediate display
      const officeWithDate = {
        ...newOffice,
        // If createdAt is not available yet, use current date
        createdAt: newOffice.createdAt || new Date()
      };
      
      setOffices([...offices, officeWithDate]);
      setAddData({ name: "", email: "", role: "office" });
      setShowAddModal(false);
      
      alert(`Office "${newOffice.name}" added successfully!`);
    } catch (err) {
      console.error("Error adding office:", err);
      setAddError(`Failed to add office: ${err.message}`);
    } finally {
      setAddLoading(false);
    }
  };

  // 🔹 Open edit modal
  const openEditModal = (index) => {
    if (index >= 0 && index < offices.length) {
      const office = offices[index];
      setEditIndex(index);
      setEditData({
        id: office.id,
        name: office.name || "",
        email: office.email || "",
        role: office.role || "office"
      });
      setEditError("");
    }
  };

  // 🔹 Save edit
  const saveEdit = async () => {
    if (editIndex === null) return;
    
    if (!editData.name.trim()) {
      setEditError("Office name is required");
      return;
    }
    
    if (!editData.email.trim()) {
      setEditError("Email is required");
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editData.email)) {
      setEditError("Please enter a valid email address");
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
      const officeToUpdate = {
        id: editData.id,
        name: editData.name,
        email: editData.email,
        role: editData.role
      };
      
      await updateOffice(officeToUpdate);
      
      const updatedOffices = [...offices];
      updatedOffices[editIndex] = {
        ...officeToUpdate,
        createdAt: offices[editIndex].createdAt, // Keep original date
        password: offices[editIndex].password // Keep original password
      };
      setOffices(updatedOffices);
      
      setEditIndex(null);
      alert(`Office "${editData.name}" updated successfully!`);
    } catch (err) {
      console.error("Error updating office:", err);
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

  // 🔹 Confirm delete
  const confirmDelete = async () => {
    if (deleteIndex === null || !deleteConfirmed) return;
    
    const officeToDelete = offices[deleteIndex];
    if (!officeToDelete || !officeToDelete.id) return;
    
    setDeleteLoading(true);
    
    try {
      await deleteOffice(officeToDelete.id);
      const updatedOffices = offices.filter((_, i) => i !== deleteIndex);
      setOffices(updatedOffices);
      setDeleteIndex(null);
      setDeleteConfirmed(false);
      alert(`Office "${officeToDelete.name}" deleted successfully!`);
    } catch (err) {
      console.error("Error deleting office:", err);
      alert(`Failed to delete office: ${err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // 🔹 Refresh offices list
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

  // Role badge styling
  const getRoleBadge = (role) => {
    const isSuper = role === "super";
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${
        isSuper 
          ? "bg-purple-100 text-purple-700" 
          : "bg-blue-100 text-blue-700"
      }`}>
        {isSuper ? "Super Admin" : "Office Admin"}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border border-[#7400EA] rounded-xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Office Accounts</h3>
          <p className="text-sm text-gray-500">
            {loading ? "Loading..." : `${offices.length} office(s) found`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refreshOffices}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            disabled={loading}
          >
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#7400EA] hover:bg-[#5B2D8B] text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
            disabled={loading}
          >
            <Plus size={18} />
            Add Office
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7400EA] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading offices...</p>
        </div>
      ) : offices.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
          <p className="text-gray-500 text-lg">No offices found</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {offices.map((office, index) => (
            <div key={office.id} className="border border-[#7400EA] rounded-xl p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-lg mb-1">{office.name}</h4>
                  <div className="flex items-center gap-2 mb-2">
                    {getRoleBadge(office.role)}
                    {office.password && (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        Pass: {office.password}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEditModal(index)} 
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    <Pencil size={16} />
                  </button>
                  <button 
                    onClick={() => setDeleteIndex(index)} 
                    className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-md"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Email:</span>
                  <span className="font-medium">{office.email || "No email"}</span>
                </div>
                
                
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Created:</span>
                  <span className="font-medium">{formatDate(office.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🔹 ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 relative">
            <button 
              onClick={() => setShowAddModal(false)} 
              className="absolute top-4 right-4 text-red-500"
            >
              <X />
            </button>
            
            <h3 className="text-lg font-semibold mb-2">Add New Office</h3>
            <p className="text-sm text-gray-500 mb-4">
              Default password will be set automatically based on role
            </p>
            
            {addError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{addError}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Office Name *</label>
                <input
                  value={addData.name}
                  onChange={(e) => setAddData({ ...addData, name: e.target.value })}
                  className="w-full mt-1 px-4 py-2 border rounded-lg"
                  placeholder="Enter office name"
                  disabled={addLoading}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Email Address *</label>
                <input
                  type="email"
                  value={addData.email}
                  onChange={(e) => setAddData({ ...addData, email: e.target.value })}
                  className="w-full mt-1 px-4 py-2 border rounded-lg"
                  placeholder="office@example.com"
                  disabled={addLoading}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">User Role *</label>
                <div className="flex gap-6 mt-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={addData.role === "super"}
                      onChange={() => setAddData({ ...addData, role: "super" })}
                      className="text-[#7400EA]"
                      disabled={addLoading}
                    />
                    <div>
                      <span className="font-medium">Super Admin</span>
                      <p className="text-xs text-gray-500">Password: superadmin2025</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={addData.role === "office"}
                      onChange={() => setAddData({ ...addData, role: "office" })}
                      className="text-[#7400EA]"
                      disabled={addLoading}
                    />
                    <div>
                      <span className="font-medium">Office Admin</span>
                      <p className="text-xs text-gray-500">Password: officeadmin2025</p>
                    </div>
                  </label>
                </div>
              </div>
              
              <div className="pt-2">
                <button 
                  onClick={saveAddOffice} 
                  className="w-full bg-[#5B2D8B] hover:bg-[#4a2470] text-white py-3 rounded-lg transition disabled:opacity-50"
                  disabled={addLoading}
                >
                  {addLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Adding Office...
                    </span>
                  ) : "ADD OFFICE"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔹 EDIT MODAL */}
      {editIndex !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 relative">
            <button 
              onClick={() => setEditIndex(null)} 
              className="absolute top-4 right-4 text-red-500"
            >
              <X />
            </button>
            
            <h3 className="text-lg font-semibold mb-6">Edit Office</h3>
            
            {editError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{editError}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Office Name</label>
                <input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full mt-1 px-4 py-2 border rounded-lg"
                  disabled={editLoading}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Email Address</label>
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="w-full mt-1 px-4 py-2 border rounded-lg"
                  disabled={editLoading}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">User Role</label>
                <div className="flex gap-6 mt-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={editData.role === "super"}
                      onChange={() => setEditData({ ...editData, role: "super" })}
                      disabled={editLoading}
                    />
                    Super Admin
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={editData.role === "office"}
                      onChange={() => setEditData({ ...editData, role: "office" })}
                      disabled={editLoading}
                    />
                    Office Admin
                  </label>
                </div>
              </div>
              
              <button 
                onClick={saveEdit} 
                className="w-full bg-[#5B2D8B] text-white py-3 rounded-lg mt-4 disabled:opacity-50"
                disabled={editLoading}
              >
                {editLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </span>
                ) : "SAVE UPDATE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔹 ENHANCED DELETE MODAL */}
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