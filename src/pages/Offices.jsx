// pages/Offices.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Pencil, Trash2, Plus, X, AlertTriangle, UserPlus, Target } from "lucide-react";
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
    
    // Convert to lowercase and remove special characters
    let emailPart = name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '.') // Replace spaces with dots
      .replace(/\.+/g, '.') // Remove duplicate dots
      .replace(/^\.+|\.+$/g, ''); // Remove dots from start/end
    
    // If email part is empty after cleaning, use a default
    if (!emailPart) {
      emailPart = "office";
    }
    
    // Add @gmail.com suffix
    return emailPart + "@gmail.com";
  };

  // 🔹 Helper function to handle office name change (auto-generates email)
  const handleAddNameChange = (value) => {
    const uppercaseName = toUppercase(value);
    const generatedEmail = generateEmailFromName(value);
    
    setAddData(prev => ({
      ...prev,
      name: uppercaseName,
      email: generatedEmail
    }));
  };

  // 🔹 Helper function to handle edit office name change (auto-generates email)
  const handleEditNameChange = (value) => {
    const uppercaseName = toUppercase(value);
    const generatedEmail = generateEmailFromName(value);
    
    setEditData(prev => ({
      ...prev,
      name: uppercaseName,
      email: generatedEmail
    }));
  };

  // 🔹 Helper function to manually override email if needed
  const handleAddEmailChange = (value) => {
    // Only allow changing the part before @gmail.com
    const domain = "@gmail.com";
    let emailValue = value.toLowerCase();
    
    // Ensure @gmail.com is always present
    if (!emailValue.endsWith(domain)) {
      // If user is trying to delete the domain, prevent it
      if (emailValue.includes(domain)) {
        // Find the position of @gmail.com
        const atIndex = emailValue.indexOf(domain);
        emailValue = emailValue.substring(0, atIndex + domain.length);
      } else {
        // Add @gmail.com if not present
        emailValue = emailValue.replace(/@.*$/, '') + domain;
      }
    }
    
    setAddData(prev => ({
      ...prev,
      email: emailValue
    }));
  };

  // 🔹 Helper function to handle edit email change
  const handleEditEmailChange = (value) => {
    // Only allow changing the part before @gmail.com
    const domain = "@gmail.com";
    let emailValue = value.toLowerCase();
    
    // Ensure @gmail.com is always present
    if (!emailValue.endsWith(domain)) {
      // If user is trying to delete the domain, prevent it
      if (emailValue.includes(domain)) {
        // Find the position of @gmail.com
        const atIndex = emailValue.indexOf(domain);
        emailValue = emailValue.substring(0, atIndex + domain.length);
      } else {
        // Add @gmail.com if not present
        emailValue = emailValue.replace(/@.*$/, '') + domain;
      }
    }
    
    setEditData(prev => ({
      ...prev,
      email: emailValue
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

  // 🔹 Add purpose to list (automatically uppercase)
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

  // 🔹 Add staff to visit list (automatically uppercase)
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

  // 🔹 Add purpose to edit list (automatically uppercase)
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

  // 🔹 Add staff to edit list (automatically uppercase)
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
      // Add office to Firestore (all fields already uppercase except email)
      const newOffice = await addOffice(addData);
      
      // 🔹 FIX: Add current date for immediate display
      const officeWithDate = {
        ...newOffice,
        // If createdAt is not available yet, use current date
        createdAt: newOffice.createdAt || new Date()
      };
      
      setOffices([...offices, officeWithDate]);
      
      // Reset form
      setAddData({ 
        name: "", 
        email: "", 
        role: "office",
        purposes: [],
        staffToVisit: []
      });
      setNewPurpose("");
      setNewStaff("");
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
        role: office.role || "office",
        purposes: office.purposes || [],
        staffToVisit: office.staffToVisit || []
      });
      setEditNewPurpose("");
      setEditNewStaff("");
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
        role: editData.role,
        purposes: editData.purposes,
        staffToVisit: editData.staffToVisit
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

  // 🔹 Render list items for purposes
  const renderPurposeList = (purposes, onRemove, isEdit = false) => (
    <div className="space-y-2">
      {purposes.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {purposes.map((purpose) => (
            <div 
              key={purpose.id} 
              className="flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm"
            >
              <Target size={14} />
              <span>{purpose.name}</span>
              <button
                type="button"
                onClick={() => onRemove(purpose.id)}
                className="ml-1 text-blue-400 hover:text-blue-600"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">No purposes added yet</p>
      )}
    </div>
  );

  // 🔹 Render list items for staff
  const renderStaffList = (staffList, onRemove, isEdit = false) => (
    <div className="space-y-2">
      {staffList.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {staffList.map((staff) => (
            <div 
              key={staff.id} 
              className="flex items-center gap-1 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-sm"
            >
              <UserPlus size={14} />
              <span>{staff.name}</span>
              <button
                type="button"
                onClick={() => onRemove(staff.id)}
                className="ml-1 text-green-400 hover:text-green-600"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">No staff/instructors added yet</p>
      )}
    </div>
  );

  // 🔹 Custom email input component
  const EmailInput = ({ value, onChange, disabled, isEdit = false, isReadOnly = false }) => {
    const domain = "@gmail.com";
    const username = value.replace(domain, '');
    
    const handleUsernameChange = (e) => {
      const newUsername = e.target.value.toLowerCase();
      if (isEdit) {
        onChange(newUsername + domain);
      } else {
        onChange(newUsername + domain);
      }
    };

    const handleKeyDown = (e) => {
      if (isReadOnly) {
        e.preventDefault();
        return;
      }
      
      // Prevent backspace/delete if cursor is at the end and trying to delete domain
      const cursorPosition = e.target.selectionStart;
      const inputLength = e.target.value.length;
      const domainStart = inputLength - domain.length;
      
      if (
        (e.key === 'Backspace' || e.key === 'Delete') && 
        cursorPosition > domainStart
      ) {
        e.preventDefault();
        // Move cursor to before the domain
        e.target.setSelectionRange(domainStart, domainStart);
      }
    };

    const handleClick = (e) => {
      if (isReadOnly) {
        e.preventDefault();
        return;
      }
      
      const cursorPosition = e.target.selectionStart;
      const inputLength = e.target.value.length;
      const domainStart = inputLength - domain.length;
      
      // If user clicks in the domain area, move cursor to before domain
      if (cursorPosition > domainStart) {
        e.target.setSelectionRange(domainStart, domainStart);
      }
    };

    return (
      <div className="relative">
        <input
          type="text"
          value={username}
          onChange={handleUsernameChange}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          className={`w-full px-4 py-2 border rounded-lg lowercase pr-24 ${
            isReadOnly ? 'bg-gray-50 cursor-not-allowed' : ''
          }`}
          placeholder="username"
          disabled={disabled || isReadOnly}
          readOnly={isReadOnly}
          style={{ textTransform: 'lowercase' }}
        />
        <div className="absolute right-0 top-0 h-full flex items-center">
          <div className="px-3 py-2 bg-gray-100 border border-l-0 rounded-r-lg text-gray-600">
            @gmail.com
          </div>
        </div>
      </div>
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
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 rounded-lg transition"
            disabled={loading}
          >
            Refresh
          </button>
          <button
            onClick={() => {
              setAddData({ 
                name: "", 
                email: "", 
                role: "office",
                purposes: [],
                staffToVisit: []
              });
              setShowAddModal(true);
            }}
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
            <div key={office.id} className="border border-[#7400EA] rounded-xl p-4 flex flex-col h-full">
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
              
              <div className="space-y-3 text-sm flex-grow">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Email:</span>
                  <span className="font-medium">{office.email || "No email"}</span>
                </div>
                
                {/* Purposes Section */}
                {(office.purposes && office.purposes.length > 0) && (
                  <div>
                    <div className="flex items-center gap-1 text-gray-500 mb-1">
                      <Target size={14} />
                      <span>Purposes:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {office.purposes.slice(0, 3).map((purpose, idx) => (
                        <span key={idx} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                          {purpose.name}
                        </span>
                      ))}
                      {office.purposes.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{office.purposes.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Staff Section */}
                {(office.staffToVisit && office.staffToVisit.length > 0) && (
                  <div>
                    <div className="flex items-center gap-1 text-gray-500 mb-1">
                      <UserPlus size={14} />
                      <span>Staff/Instructors:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {office.staffToVisit.slice(0, 3).map((staff, idx) => (
                        <span key={idx} className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded">
                          {staff.name}
                        </span>
                      ))}
                      {office.staffToVisit.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{office.staffToVisit.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Created Date - Placed at the bottom */}
              <div className="mt-auto pt-3 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Created:</span>
                  <span className="font-medium">{formatDate(office.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🔹 ENHANCED ADD MODAL WITH NEW FIELDS */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold">Add New Office</h3>
                <p className="text-sm text-gray-500">
                  Default password will be set automatically based on role
                </p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {addError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{addError}</p>
                </div>
              )}
              
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-2">Office Name *</label>
                    <input
                      value={addData.name}
                      onChange={(e) => handleAddNameChange(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg uppercase"
                      placeholder="ENTER OFFICE NAME"
                      disabled={addLoading}
                      style={{ textTransform: 'uppercase' }}
                    />
                    
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium block mb-2">Email Address *</label>
                    <EmailInput
                      value={addData.email}
                      onChange={handleAddEmailChange}
                      disabled={addLoading}
                      isReadOnly={false}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Email auto-generated from office name.
                    </p>
                  </div>
                </div>

                {/* User Role */}
                <div>
                  <label className="text-sm font-medium block mb-3">User Role *</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                      addData.role === "super" ? "border-[#7400EA] bg-purple-50" : "border-gray-200 hover:border-gray-300"
                    }`}>
                      <input
                        type="radio"
                        checked={addData.role === "super"}
                        onChange={() => setAddData(prev => ({ ...prev, role: "super" }))}
                        className="mt-1 text-[#7400EA]"
                        disabled={addLoading}
                      />
                      <div>
                        <span className="font-medium">Super Admin</span>
                        <p className="text-xs text-gray-500 mt-1">Password: superadmin2025</p>
                      </div>
                    </label>
                    
                    <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                      addData.role === "office" ? "border-[#7400EA] bg-blue-50" : "border-gray-200 hover:border-gray-300"
                    }`}>
                      <input
                        type="radio"
                        checked={addData.role === "office"}
                        onChange={() => setAddData(prev => ({ ...prev, role: "office" }))}
                        className="mt-1 text-[#7400EA]"
                        disabled={addLoading}
                      />
                      <div>
                        <span className="font-medium">Office Admin</span>
                        <p className="text-xs text-gray-500 mt-1">Password: officeadmin2025</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Purposes of Visit */}
                <div className="border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="text-blue-600" />
                    <h4 className="font-semibold">Purposes of Visit</h4>
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                      {addData.purposes.length} added
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newPurpose}
                        onChange={(e) => handlePurposeInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addPurposeToList()}
                        className="flex-1 px-4 py-2 border rounded-lg uppercase"
                        placeholder="ADD A PURPOSE (E.G., MEETING, TRAINING, CONSULTATION)"
                        disabled={addLoading}
                        style={{ textTransform: 'uppercase' }}
                      />
                      <button
                        type="button"
                        onClick={addPurposeToList}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        disabled={addLoading}
                      >
                        Add
                      </button>
                    </div>
                    
                    {renderPurposeList(addData.purposes, removePurposeFromList)}
                    
                    <div className="text-xs text-gray-500">
                      Tip: Press Enter or click Add to add multiple purposes
                    </div>
                  </div>
                </div>

                {/* Staff/Instructors to Visit */}
                <div className="border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <UserPlus className="text-green-600" />
                    <h4 className="font-semibold">Staff/Instructors to Visit</h4>
                    <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
                      {addData.staffToVisit.length} added
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newStaff}
                        onChange={(e) => handleStaffInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addStaffToList()}
                        className="flex-1 px-4 py-2 border rounded-lg uppercase"
                        placeholder="ADD STAFF/INSTRUCTOR NAME"
                        disabled={addLoading}
                        style={{ textTransform: 'uppercase' }}
                      />
                      <button
                        type="button"
                        onClick={addStaffToList}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        disabled={addLoading}
                      >
                        Add
                      </button>
                    </div>
                    
                    {renderStaffList(addData.staffToVisit, removeStaffFromList)}
                    
                    <div className="text-xs text-gray-500">
                      Tip: Add multiple staff members or instructors who can be visited
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-4 border-t">
                  <button 
                    onClick={saveAddOffice} 
                    className="w-full bg-gradient-to-r from-[#7400EA] to-[#5B2D8B] hover:from-[#5B2D8B] hover:to-[#4a2470] text-white py-3 rounded-lg transition disabled:opacity-50 font-semibold"
                    disabled={addLoading}
                  >
                    {addLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Adding Office...
                      </span>
                    ) : "CREATE OFFICE ACCOUNT"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔹 ENHANCED EDIT MODAL */}
      {editIndex !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold">Edit Office</h3>
                <p className="text-sm text-gray-500">
                  Update office details and preferences
                </p>
              </div>
              <button 
                onClick={() => setEditIndex(null)} 
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {editError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{editError}</p>
                </div>
              )}
              
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-2">Office Name *</label>
                    <input
                      value={editData.name}
                      onChange={(e) => handleEditNameChange(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg uppercase"
                      disabled={editLoading}
                      style={{ textTransform: 'uppercase' }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Changing office name will auto-update the email
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium block mb-2">Email Address *</label>
                    <EmailInput
                      value={editData.email}
                      onChange={handleEditEmailChange}
                      disabled={editLoading}
                      isEdit={true}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Email auto-updates with office name. @gmail.com is fixed.
                    </p>
                  </div>
                </div>

                {/* User Role */}
                <div>
                  <label className="text-sm font-medium block mb-3">User Role *</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                      editData.role === "super" ? "border-[#7400EA] bg-purple-50" : "border-gray-200 hover:border-gray-300"
                    }`}>
                      <input
                        type="radio"
                        checked={editData.role === "super"}
                        onChange={() => setEditData(prev => ({ ...prev, role: "super" }))}
                        className="mt-1"
                        disabled={editLoading}
                      />
                      <div>
                        <span className="font-medium">Super Admin</span>
                      </div>
                    </label>
                    
                    <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                      editData.role === "office" ? "border-[#7400EA] bg-blue-50" : "border-gray-200 hover:border-gray-300"
                    }`}>
                      <input
                        type="radio"
                        checked={editData.role === "office"}
                        onChange={() => setEditData(prev => ({ ...prev, role: "office" }))}
                        className="mt-1"
                        disabled={editLoading}
                      />
                      <div>
                        <span className="font-medium">Office Admin</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Purposes of Visit */}
                <div className="border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="text-blue-600" />
                    <h4 className="font-semibold">Purposes of Visit</h4>
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                      {editData.purposes.length} added
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editNewPurpose}
                        onChange={(e) => handlePurposeInput(e.target.value, true)}
                        onKeyPress={(e) => e.key === 'Enter' && addPurposeToEditList()}
                        className="flex-1 px-4 py-2 border rounded-lg uppercase"
                        placeholder="ADD A PURPOSE"
                        disabled={editLoading}
                        style={{ textTransform: 'uppercase' }}
                      />
                      <button
                        type="button"
                        onClick={addPurposeToEditList}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        disabled={editLoading}
                      >
                        Add
                      </button>
                    </div>
                    
                    {renderPurposeList(editData.purposes, removePurposeFromEditList, true)}
                  </div>
                </div>

                {/* Staff/Instructors to Visit */}
                <div className="border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <UserPlus className="text-green-600" />
                    <h4 className="font-semibold">Staff/Instructors to Visit</h4>
                    <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
                      {editData.staffToVisit.length} added
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editNewStaff}
                        onChange={(e) => handleStaffInput(e.target.value, true)}
                        onKeyPress={(e) => e.key === 'Enter' && addStaffToEditList()}
                        className="flex-1 px-4 py-2 border rounded-lg uppercase"
                        placeholder="ADD STAFF/INSTRUCTOR NAME"
                        disabled={editLoading}
                        style={{ textTransform: 'uppercase' }}
                      />
                      <button
                        type="button"
                        onClick={addStaffToEditList}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        disabled={editLoading}
                      >
                        Add
                      </button>
                    </div>
                    
                    {renderStaffList(editData.staffToVisit, removeStaffFromEditList, true)}
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-4 border-t">
                  <button 
                    onClick={saveEdit} 
                    className="w-full bg-gradient-to-r from-[#7400EA] to-[#5B2D8B] hover:from-[#5B2D8B] hover:to-[#4a2470] text-white py-3 rounded-lg transition disabled:opacity-50 font-semibold"
                    disabled={editLoading}
                  >
                    {editLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Saving Changes...
                      </span>
                    ) : "UPDATE OFFICE"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔹 DELETE MODAL - COMPLETE VERSION */}
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