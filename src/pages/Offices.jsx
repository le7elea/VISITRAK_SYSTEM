// pages/Offices.jsx
import React, { useState, useEffect, useCallback, memo } from "react";
import { Pencil, Trash2, Plus, X, AlertTriangle, UserPlus, Target, Mail, Calendar, Users, Hash, Key, Building, User, Check, Shield, Lock } from "lucide-react";
import { fetchOffices, addOffice, updateOffice, deleteOffice } from "../lib/info.services";

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ==================== MEMOIZED COMPONENTS ====================

const EmailDisplay = memo(({ email }) => {
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
});
EmailDisplay.displayName = 'EmailDisplay';

const StatItem = memo(({ icon: Icon, label, value, color = "gray" }) => {
  const colorClasses = {
    gray: "bg-gray-50 text-gray-600",
    purple: "bg-purple-50 text-purple-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600"
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`p-1.5 rounded-md ${colorClasses[color]}`}>
        <Icon size={14} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
});
StatItem.displayName = 'StatItem';

const OfficeCard = memo(({ office, index, onEdit, onDelete }) => {
  // Helper function to convert to uppercase
  const toUppercase = useCallback((text) => text ? text.toUpperCase() : "", []);

  // Smart date formatter
  const formatDate = useCallback((timestamp) => {
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
  }, []);

  // Role badge styling
  const getRoleBadge = useCallback((role) => {
    const isSuper = role === "super";
    return (
      <span className={`text-[10px] font-medium tracking-wider px-2 py-1 rounded-full border ${
        isSuper 
          ? "bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border-purple-200" 
          : "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200"
      }`}>
        {isSuper ? "SUPER ADMIN" : "OFFICE ADMIN"}
      </span>
    );
  }, []);

  const defaultPassword = office.role === "super" ? "superadmin2025" : "officeadmin2025";
  const passwordAlreadyChanged = office.passwordChanged === true;

  return (
    <div className={`bg-white rounded-2xl border p-6 transition-all duration-300 hover:shadow-xl group flex flex-col dark:bg-gray-800 ${
      office.role === "super" 
        ? "border-purple-300 hover:border-purple-400 dark:border-purple-600" 
        : "border-gray-200 hover:border-[#7400EA]/20 dark:border-gray-700"
    }`}>
      {/* Card Header with Role Badge */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center dark:bg-white ${
              office.role === "super" 
                ? "bg-gradient-to-br from-purple-500/20 to-purple-700/20" 
                : "bg-gradient-to-br from-[#7400EA]/20 to-[#5B2D8B]/20"
            }`}>
              {office.role === "super" ? (
                <Shield className="w-5 h-5 text-purple-600" />
              ) : (
                <span className="text-lg font-bold text-[#7400EA]">
                  {office.name?.charAt(0).toUpperCase() || "O"}
                </span>
              )}
            </div>
            {getRoleBadge(office.role)}
            {office.role === "super" && (
              <span className="text-[8px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                PROTECTED
              </span>
            )}
          </div>
          <h4 className={`text-xl font-bold group-hover:text-[#7400EA] transition-colors dark:text-gray-100 ${
            office.role === "super" ? "text-purple-700 group-hover:text-purple-600" : "text-gray-800"
          }`}>
            {office.name}
            {office.role === "super" && (
              <Lock className="inline ml-2 w-4 h-4 text-purple-500" />
            )}
          </h4>
          {office.officialName && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2 dark:text-gray-500">
              {office.officialName}
            </p>
          )}
        </div>
        
        {/* Action Buttons - Hide delete for super admin */}
        <div className="flex gap-1">
          <button 
            onClick={() => onEdit(index)} 
            className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${
              office.role === "super" 
                ? "text-purple-500 hover:text-purple-700 hover:bg-purple-50" 
                : "text-gray-500 hover:text-[#7400EA]"
            }`}
            title="Edit"
          >
            <Pencil size={16} />
          </button>
          {office.role !== "super" && (
            <button 
              onClick={() => onDelete(index)} 
              className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-500 hover:text-red-600"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      
      {/* Office Info Stats - Minimal Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6 dark:text-white">
        <StatItem 
          icon={Mail} 
          label="Email" 
          value={office.email ? office.email.split('@')[0] : "N/A"} 
          color={office.role === "super" ? "purple" : "purple"}
        />
        <StatItem 
          icon={Calendar} 
          label="Created" 
          value={formatDate(office.createdAt)} 
          color={office.role === "super" ? "purple" : "blue"}
        />
        {office.purposes?.length > 0 && (
          <StatItem 
            icon={Target} 
            label="Purposes" 
            value={office.purposes.length} 
            color={office.role === "super" ? "purple" : "green"}
          />
        )}
        {office.staffToVisit?.length > 0 && (
          <StatItem 
            icon={Users} 
            label="Staff" 
            value={office.staffToVisit.length} 
            color={office.role === "super" ? "purple" : "orange"}
          />
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Password Status:</span>
          {passwordAlreadyChanged ? (
            <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-medium">
              Already changed
            </span>
          ) : (
            <code className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-700 text-xs">
              {defaultPassword}
            </code>
          )}
        </div>
      </div>
    </div>
  );
});
OfficeCard.displayName = 'OfficeCard';

// ==================== MODAL COMPONENTS ====================

const AddOfficeModal = memo(({ 
  show, 
  onClose, 
  onSave, 
  data, 
  onDataChange, 
  newPurpose, 
  onNewPurposeChange,
  newStaff,
  onNewStaffChange,
  loading
}) => {
  if (!show) return null;

  const toUppercase = (text) => text ? text.toUpperCase() : "";
  

  const handleNameChange = (value) => {
  onDataChange({
    ...data,
    name: toUppercase(value)
  });
};


  const addPurposeToList = () => {
    if (newPurpose.trim() === "") return;
    
    onDataChange({
      ...data,
      purposes: [...data.purposes, { 
        id: Date.now().toString(), 
        name: toUppercase(newPurpose.trim())
      }]
    });
    onNewPurposeChange("");
  };

  const removePurposeFromList = (id) => {
    onDataChange({
      ...data,
      purposes: data.purposes.filter(purpose => purpose.id !== id)
    });
  };

  const addStaffToList = () => {
    if (newStaff.trim() === "") return;
    
    onDataChange({
      ...data,
      staffToVisit: [...data.staffToVisit, { 
        id: Date.now().toString(), 
        name: toUppercase(newStaff.trim())
      }]
    });
    onNewStaffChange("");
  };

  const removeStaffFromList = (id) => {
    onDataChange({
      ...data,
      staffToVisit: data.staffToVisit.filter(staff => staff.id !== id)
    });
  };

  const renderList = (items, onRemove, type = "purpose") => {
    const isPurpose = type === "purpose";
    
    if (items.length === 0) {
      return (
        <div className="text-center py-4 border border-dashed border-gray-300 rounded-xl">
          {isPurpose ? (
            <>
              <Target className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No purposes added yet</p>
            </>
          ) : (
            <>
              <UserPlus className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No staff/instructors added yet</p>
            </>
          )}
        </div>
      );
    }
    
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div 
            key={item.id} 
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:scale-[1.02] ${
              isPurpose 
                ? "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700" 
                : "bg-gradient-to-r from-green-50 to-green-100 text-green-700"
            }`}
          >
            {isPurpose ? <Target size={14} /> : <UserPlus size={14} />}
            <span className="font-medium">{item.name}</span>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className={`ml-1 ${isPurpose ? "text-blue-400 hover:text-blue-600" : "text-green-400 hover:text-green-600"} transition-colors`}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
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
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
              <X className="text-white" size={24} />
            </button>
          </div>
        </div>
        
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
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
                    Office Name (e,g: SDS, Registrar, etc.)
                  </label>
                  <div className="relative">
                    <input
                      value={data.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:border-[#7400EA] focus:ring-2 focus:ring-[#7400EA]/20 transition-all uppercase"
                      placeholder="Enter office name"
                      disabled={loading}
                      style={{ textTransform: 'uppercase' }}
                    />
                    
                  </div>
                  <div className="mt-4">
  <label className="text-sm font-medium text-gray-700 block mb-2">
    Office Email <span className="text-red-500">*</span>
  </label>

  <input
    type="email"
    value={data.email}
    onChange={(e) =>
      onDataChange({ ...data, email: e.target.value.toLowerCase() })
    }
    className="w-full px-4 py-3 border border-gray-300 rounded-xl"
    placeholder="office@example.com"
    disabled={loading}
  />
</div>

                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-3">
                    Official Office Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      value={data.officialName}
                      onChange={(e) => onDataChange({ ...data, officialName: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:border-[#7400EA] focus:ring-2 focus:ring-[#7400EA]/20 transition-all"
                      placeholder="e.g., Office of the Registrar"
                      disabled={loading}
                    />
                    <div className="absolute right-3 top-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Full Name</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* User Role - Only Office Admin for new offices */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Key className="w-5 h-5 text-blue-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-800">Access Level</h4>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {/* Only Office Admin Option - Auto-selected */}
                  <label className="relative overflow-hidden rounded-xl border-2 border-blue-500 bg-blue-50 cursor-not-allowed">
                    <input
                      type="radio"
                      checked={true}
                      className="sr-only"
                      disabled
                    />
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-100">
                            <Building className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="font-semibold text-gray-800">Office Admin</span>
                        </div>
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Initial Password:</span>
                          <code className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">officeadmin2025</code>
                        </div>
                        <p className="text-xs text-gray-500">Limited to specific office functions and data</p>
                        <p className="text-xs text-blue-500 font-medium mt-2">
                          ℹ️ All new offices are created as Office Admins.
                        </p>
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
                  {data.purposes.length} added
                </span>
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={newPurpose}
                      onChange={(e) => onNewPurposeChange(toUppercase(e.target.value))}
                      onKeyPress={(e) => e.key === 'Enter' && addPurposeToList()}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all uppercase"
                      placeholder="Add a purpose (e.g., MEETING, CONSULTATION)"
                      disabled={loading}
                      style={{ textTransform: 'uppercase' }}
                    />
                    <div className="absolute right-3 top-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">UPPERCASE</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addPurposeToList}
                    disabled={loading || !newPurpose.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                  >
                    <Plus size={18} />
                    Add
                  </button>
                </div>
                
                {renderList(data.purposes, removePurposeFromList, "purpose")}
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
                  {data.staffToVisit.length} added
                </span>
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={newStaff}
                      onChange={(e) => onNewStaffChange(toUppercase(e.target.value))}
                      onKeyPress={(e) => e.key === 'Enter' && addStaffToList()}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all uppercase"
                      placeholder="Add staff/instructor name"
                      disabled={loading}
                      style={{ textTransform: 'uppercase' }}
                    />
                    <div className="absolute right-3 top-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">UPPERCASE</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addStaffToList}
                    disabled={loading || !newStaff.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                  >
                    <Plus size={18} />
                    Add
                  </button>
                </div>
                
                {renderList(data.staffToVisit, removeStaffFromList, "staff")}
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-6 border-t border-gray-200">
              <button 
                onClick={onSave} 
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#7400EA] to-[#5B2D8B] hover:from-[#5B2D8B] hover:to-[#4a2470] text-white py-4 rounded-xl transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading ? (
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
AddOfficeModal.displayName = 'AddOfficeModal';

// ==================== MAIN COMPONENT ====================

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
    role: "office", // Always "office" for new offices
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

  // 🔹 Helper functions with useCallback
  const toUppercase = useCallback((text) => text ? text.toUpperCase() : "", []);
  
  // 🔹 Generate email from name
  const generateEmailFromName = useCallback((name) => {
    if (!name || !name.trim()) return "";
    
    // Convert name to lowercase, remove spaces and special characters
    const emailPart = name
      .toLowerCase()
      .replace(/\s+/g, '.')  // Replace spaces with dots
      .replace(/[^a-z0-9.]/g, '')  // Remove non-alphanumeric except dots
      .replace(/\.+/g, '.')  // Replace multiple dots with single dot
      .replace(/^\.|\.$/g, ''); // Remove leading/trailing dots
      
    return emailPart ? `${emailPart}@gmail.com` : "";
  }, []);

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

  // 🔹 Reset delete confirmation when modal closes
  useEffect(() => {
    if (deleteIndex === null) {
      setDeleteConfirmed(false);
    }
  }, [deleteIndex]);

  // 🔹 Handle add office name change
  const handleAddNameChange = useCallback((value) => {
    const uppercaseName = toUppercase(value);
    const generatedEmail = generateEmailFromName(value);
    
    setAddData(prev => ({
      ...prev,
      name: uppercaseName,
      email: generatedEmail
    }));
  }, [toUppercase, generateEmailFromName]);

  // 🔹 Handle add purpose input
  const handleAddPurposeInput = useCallback((value) => {
    setNewPurpose(toUppercase(value));
  }, [toUppercase]);

  // 🔹 Handle add staff input
  const handleAddStaffInput = useCallback((value) => {
    setNewStaff(toUppercase(value));
  }, [toUppercase]);

  // 🔹 OPTIMIZED: Add Office - Update local state immediately
  const saveAddOffice = useCallback(async () => {
    if (!addData.name.trim()) {
      setAddError("Office name is required");
      return;
    }
    
    if (!addData.officialName.trim()) {
      setAddError("Official office name is required");
      return;
    }

    if (!isValidEmail(addData.email)) {
      setAddError("Invalid email address");
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
      const tempId = `temp_${Date.now()}`;
      
      const tempOffice = {
        id: tempId,
        name: addData.name,
        officialName: addData.officialName,
        email: addData.email,
        role: "office", // Always office admin
        passwordChanged: false,
        passwordChangedAt: null,
        purposes: addData.purposes,
        staffToVisit: addData.staffToVisit,
        createdAt: new Date()
      };
      
      // Update local state immediately
      setOffices(prev => [...prev, tempOffice]);
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
      
      alert(`Office "${addData.name}" added successfully!`);
      
      // Save to Firestore in background
      setTimeout(async () => {
        try {
          const newOffice = await addOffice({
            ...addData,
            role: "office" // Ensure it's office admin
          });
          
          setOffices(prev => prev.map(office => 
            office.id === tempId 
              ? { ...newOffice, createdAt: newOffice.createdAt || new Date() }
              : office
          ));
        } catch (err) {
          console.error("Error saving office to Firestore:", err);
          setOffices(prev => prev.filter(office => office.id !== tempId));
          alert(`Warning: Office "${addData.name}" failed to save to database: ${err.message}`);
        } finally {
          setAddLoading(false);
        }
      }, 0);
      
    } catch (err) {
      console.error("Error in add office process:", err);
      setAddError(`Failed to add office: ${err.message}`);
      setAddLoading(false);
    }
  }, [addData, offices]);

  // 🔹 Open edit modal
  const openEditModal = useCallback((index) => {
    if (index >= 0 && index < offices.length) {
      const office = offices[index];
      setEditIndex(index);
      setEditData({
        id: office.id,
        name: office.name || "",
        officialName: office.officialName || "",
        email: office.email || "",
        role: office.role || "office", // Preserve original role
        passwordChanged: office.passwordChanged === true,
        passwordChangedAt: office.passwordChangedAt || null,
        purposes: office.purposes || [],
        staffToVisit: office.staffToVisit || []
      });
      setEditNewPurpose("");
      setEditNewStaff("");
      setEditError("");
    }
  }, [offices]);

  // 🔹 Handle edit office name change
  const handleEditNameChange = useCallback((value) => {
    const uppercaseName = toUppercase(value);
    const generatedEmail = generateEmailFromName(value);
    
    setEditData(prev => ({
      ...prev,
      name: uppercaseName,
      email: generatedEmail
    }));
  }, [toUppercase, generateEmailFromName]);

  // 🔹 Handle edit purpose input
  const handleEditPurposeInput = useCallback((value) => {
    setEditNewPurpose(toUppercase(value));
  }, [toUppercase]);

  // 🔹 Handle edit staff input
  const handleEditStaffInput = useCallback((value) => {
    setEditNewStaff(toUppercase(value));
  }, [toUppercase]);

  // 🔹 Add purpose to edit list
  const addPurposeToEditList = useCallback(() => {
    if (editNewPurpose.trim() === "") return;
    
    setEditData(prev => ({
      ...prev,
      purposes: [...prev.purposes, { 
        id: Date.now().toString(), 
        name: toUppercase(editNewPurpose.trim())
      }]
    }));
    setEditNewPurpose("");
  }, [editNewPurpose, toUppercase]);

  // 🔹 Remove purpose from edit list
  const removePurposeFromEditList = useCallback((id) => {
    setEditData(prev => ({
      ...prev,
      purposes: prev.purposes.filter(purpose => purpose.id !== id)
    }));
  }, []);

  // 🔹 Add staff to edit list
  const addStaffToEditList = useCallback(() => {
    if (editNewStaff.trim() === "") return;
    
    setEditData(prev => ({
      ...prev,
      staffToVisit: [...prev.staffToVisit, { 
        id: Date.now().toString(), 
        name: toUppercase(editNewStaff.trim())
      }]
    }));
    setEditNewStaff("");
  }, [editNewStaff, toUppercase]);

  // 🔹 Remove staff from edit list
  const removeStaffFromEditList = useCallback((id) => {
    setEditData(prev => ({
      ...prev,
      staffToVisit: prev.staffToVisit.filter(staff => staff.id !== id)
    }));
  }, []);

  // 🔹 OPTIMIZED: Save edit - Update local state immediately
  const saveEdit = useCallback(async () => {
    if (editIndex === null) return;
    
    if (!editData.name.trim()) {
      setEditError("Office name is required");
      return;
    }

    if (!isValidEmail(editData.email)) {
      setEditError("Invalid email address");
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
      const updatedOffice = {
        id: editData.id,
        name: editData.name,
        officialName: editData.officialName,
        email: editData.email,
        role: editData.role, // Keep original role (super or office)
        passwordChanged: editData.passwordChanged === true,
        passwordChangedAt: editData.passwordChangedAt || null,
        purposes: editData.purposes,
        staffToVisit: editData.staffToVisit,
        createdAt: originalOffice.createdAt
      };
      
      // Update local state immediately
      const updatedOffices = [...offices];
      updatedOffices[editIndex] = updatedOffice;
      setOffices(updatedOffices);
      setEditIndex(null);
      
      alert(`Office "${editData.name}" updated successfully!`);
      
      // Save to Firestore in background
      setTimeout(async () => {
        try {
          await updateOffice(updatedOffice);
        } catch (err) {
          console.error("Error updating office in Firestore:", err);
          const revertedOffices = [...offices];
          revertedOffices[editIndex] = originalOffice;
          setOffices(revertedOffices);
          alert(`Warning: Changes to "${editData.name}" were reverted due to database error: ${err.message}`);
        } finally {
          setEditLoading(false);
        }
      }, 0);
      
    } catch (err) {
      console.error("Error in edit process:", err);
      setEditError(`Failed to update office: ${err.message}`);
      setEditLoading(false);
    }
  }, [editIndex, editData, offices]);

  // 🔹 OPTIMIZED: Confirm delete - Update local state immediately
  const confirmDelete = useCallback(async () => {
    if (deleteIndex === null || !deleteConfirmed) return;
    
    const officeToDelete = offices[deleteIndex];
    if (!officeToDelete || !officeToDelete.id) return;
    
    // 🔹 PREVENT deleting super admin
    if (officeToDelete.role === "super") {
      alert("Super Admin accounts cannot be deleted. This account is protected.");
      setDeleteIndex(null);
      setDeleteConfirmed(false);
      return;
    }
    
    const originalOffice = officeToDelete;
    setDeleteLoading(true);
    
    try {
      // Update local state immediately
      const updatedOffices = offices.filter((_, i) => i !== deleteIndex);
      setOffices(updatedOffices);
      setDeleteIndex(null);
      setDeleteConfirmed(false);
      
      alert(`Office "${officeToDelete.name}" deleted successfully!`);
      
      // Delete from Firestore in background
      setTimeout(async () => {
        try {
          await deleteOffice(officeToDelete.id);
        } catch (err) {
          console.error("Error deleting office from Firestore:", err);
          setOffices(prev => {
            const restored = [...prev];
            restored.splice(deleteIndex, 0, originalOffice);
            return restored;
          });
          alert(`Warning: "${officeToDelete.name}" was restored due to database error: ${err.message}`);
        } finally {
          setDeleteLoading(false);
        }
      }, 0);
      
    } catch (err) {
      console.error("Error in delete process:", err);
      alert(`Failed to delete office: ${err.message}`);
      setDeleteLoading(false);
    }
  }, [deleteIndex, deleteConfirmed, offices]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="rounded-xl p-6 bg-white text-black border border-[#5B2D8B] dark:border-purple-600 dark:bg-gray-800 dark:text-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-2xl font-bold mb-2">Office Accounts</h3>
            <p className="text-black/80 dark:text-gray-400">
              {loading ? "Loading..." : `${offices.length} office${offices.length !== 1 ? 's' : ''} registered`}
              {offices.some(o => o.role === "super") && " (Super Admin protected)"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
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
            <OfficeCard 
              key={office.id}
              office={office}
              index={index}
              onEdit={openEditModal}
              onDelete={setDeleteIndex}
            />
          ))}
        </div>
      )}

      {/* 🔹 ADD MODAL */}
      <AddOfficeModal 
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={saveAddOffice}
        data={addData}
        onDataChange={setAddData}
        newPurpose={newPurpose}
        onNewPurposeChange={handleAddPurposeInput}
        newStaff={newStaff}
        onNewStaffChange={handleAddStaffInput}
        loading={addLoading}
      />

      {/* 🔹 EDIT MODAL */}
      {editIndex !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className={`sticky top-0 bg-gradient-to-r text-white px-8 py-6 ${
              editData.role === "super" 
                ? "from-purple-600 to-purple-700" 
                : "from-blue-600 to-blue-700"
            }`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    {editData.role === "super" ? (
                      <Shield size={24} />
                    ) : (
                      <Pencil size={24} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">
                      {editData.role === "super" ? "Edit Super Admin" : "Edit Office"}
                    </h3>
                    <p className="text-white/80 text-sm mt-1">
                      {editData.role === "super" 
                        ? "Update Super Admin account details" 
                        : "Update office details and preferences"}
                    </p>
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
              
              {/* Super Admin Warning */}
              {editData.role === "super" && (
                <div className="mb-6 p-4 bg-purple-50 border-l-4 border-purple-500 rounded-r-lg">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-purple-800 mb-1">
                        ⚠️ Super Admin Account (Protected)
                      </p>
                      <p className="text-sm text-purple-700">
                        This is a protected Super Admin account. You can edit its details but cannot delete it or change its role.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-8">
                {/* Basic Information */}
                <div className={`rounded-2xl p-6 ${
                  editData.role === "super" ? "bg-purple-50" : "bg-gray-50"
                }`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`p-2 rounded-lg ${
                      editData.role === "super" ? "bg-purple-100" : "bg-blue-100"
                    }`}>
                      {editData.role === "super" ? (
                        <Shield className="w-5 h-5 text-purple-600" />
                      ) : (
                        <Building className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <h4 className="text-lg font-semibold text-gray-800">
                      {editData.role === "super" ? "Super Admin Details" : "Office Details"}
                    </h4>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-3">
                        {editData.role === "super" ? "Super Admin Name" : "Office Name (e,g: SDS, Registrar, etc.)"}
                      </label>
                      <div className="relative">
                        <input
                          value={editData.name || ""}
                          onChange={(e) => handleEditNameChange(e.target.value)}
                          className={`w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 transition-all uppercase ${
                            editData.role === "super" 
                              ? "border-purple-300 focus:border-purple-500 focus:ring-purple-500/20" 
                              : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                          }`}
                          disabled={editLoading}
                          style={{ textTransform: 'uppercase' }}
                        />
                        <div className="absolute right-3 top-3">
                          <span className={`text-xs px-2 py-1 rounded ${
                            editData.role === "super" 
                              ? "bg-purple-100 text-purple-600" 
                              : "bg-blue-100 text-blue-600"
                          }`}>
                            UPPERCASE
                          </span>
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="text-sm font-medium text-gray-700 block mb-2">
                          Email <span className="text-red-500">*</span>
                        </label>

                        <input
                          type="email"
                          value={editData.email}
                          onChange={(e) =>
                            setEditData(prev => ({ ...prev, email: e.target.value.toLowerCase() }))
                          }
                          className={`w-full px-4 py-3 border rounded-xl ${
                            editData.role === "super" 
                              ? "border-purple-300 focus:border-purple-500" 
                              : "border-gray-300 focus:border-blue-500"
                          }`}
                          disabled={editLoading}
                        />
                      </div>

                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-3">
                        {editData.role === "super" ? "Full Name / Title" : "Official Office Name"} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          value={editData.officialName || ""}
                          onChange={(e) => setEditData(prev => ({ ...prev, officialName: e.target.value }))}
                          className={`w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 ${
                            editData.role === "super" 
                              ? "border-purple-300 focus:border-purple-500 focus:ring-purple-500/20" 
                              : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                          }`}
                          placeholder={editData.role === "super" ? "Enter full name or title" : "Enter official office name"}
                          disabled={editLoading}
                        />
                        <div className="absolute right-3 top-3">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Full Name</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* User Role - Show current role but cannot change */}
                <div className={`rounded-2xl p-6 ${
                  editData.role === "super" ? "bg-purple-50" : "bg-gray-50"
                }`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`p-2 rounded-lg ${
                      editData.role === "super" ? "bg-purple-100" : "bg-blue-100"
                    }`}>
                      {editData.role === "super" ? (
                        <Shield className="w-5 h-5 text-purple-600" />
                      ) : (
                        <Key className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <h4 className="text-lg font-semibold text-gray-800">Access Level</h4>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      {/* Display current role - cannot be changed */}
                      <label className={`relative overflow-hidden rounded-xl border-2 cursor-not-allowed ${
                        editData.role === "super" 
                          ? "border-purple-500 bg-gradient-to-r from-purple-50 to-purple-100" 
                          : "border-blue-500 bg-gradient-to-r from-blue-50 to-blue-100"
                      }`}>
                        <div className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                editData.role === "super" ? "bg-purple-100" : "bg-blue-100"
                              }`}>
                                {editData.role === "super" ? (
                                  <Shield className="w-4 h-4 text-purple-600" />
                                ) : (
                                  <Building className="w-4 h-4 text-blue-600" />
                                )}
                              </div>
                              <div>
                                <span className="font-semibold text-gray-800">
                                  {editData.role === "super" ? "Super Admin" : "Office Admin"}
                                </span>
                                <p className="text-xs text-gray-500 mt-1">
                                  {editData.role === "super" 
                                    ? "Full system access and administration privileges" 
                                    : "Limited to specific office functions and data"}
                                </p>
                              </div>
                            </div>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              editData.role === "super" ? "bg-purple-500" : "bg-blue-500"
                            }`}>
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Password Status:</span>
                              {editData.passwordChanged ? (
                                <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                                  Already changed
                                </span>
                              ) : (
                                <code className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-700 text-xs">
                                  {editData.role === "super" ? "superadmin2025" : "officeadmin2025"}
                                </code>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">Credentials are managed in Firebase Auth.</p>
                            <p className="text-xs text-gray-500">
                              {editData.role === "super" 
                                ? "Account role is protected and cannot be changed" 
                                : "Account role cannot be changed"}
                            </p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Purposes of Visit */}
                <div className={`rounded-2xl p-6 ${
                  editData.role === "super" ? "bg-purple-50" : "bg-gray-50"
                }`}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        editData.role === "super" ? "bg-purple-100" : "bg-blue-100"
                      }`}>
                        <Target className={`w-5 h-5 ${
                          editData.role === "super" ? "text-purple-600" : "text-blue-600"
                        }`} />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800">Visit Purposes</h4>
                        <p className="text-sm text-gray-500">What visitors can select when visiting</p>
                      </div>
                    </div>
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                      editData.role === "super" 
                        ? "bg-purple-100 text-purple-600" 
                        : "bg-blue-100 text-blue-600"
                    }`}>
                      {editData.purposes.length} added
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={editNewPurpose}
                          onChange={(e) => handleEditPurposeInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addPurposeToEditList()}
                          className={`w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 transition-all uppercase ${
                            editData.role === "super" 
                              ? "border-purple-300 focus:border-purple-500 focus:ring-purple-500/20" 
                              : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                          }`}
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
                        className={`px-6 py-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium ${
                          editData.role === "super"
                            ? "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                            : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                        } text-white`}
                      >
                        <Plus size={18} />
                        Add
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {editData.purposes.map((purpose) => (
                        <div 
                          key={purpose.id} 
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:scale-[1.02] ${
                            editData.role === "super"
                              ? "bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700"
                              : "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700"
                          }`}
                        >
                          <Target size={14} className="flex-shrink-0" />
                          <span className="font-medium">{purpose.name}</span>
                          <button
                            type="button"
                            onClick={() => removePurposeFromEditList(purpose.id)}
                            className={`ml-1 transition-colors ${
                              editData.role === "super"
                                ? "text-purple-400 hover:text-purple-600"
                                : "text-blue-400 hover:text-blue-600"
                            }`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Staff/Instructors to Visit */}
                <div className={`rounded-2xl p-6 ${
                  editData.role === "super" ? "bg-purple-50" : "bg-gray-50"
                }`}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        editData.role === "super" ? "bg-purple-100" : "bg-green-100"
                      }`}>
                        <UserPlus className={`w-5 h-5 ${
                          editData.role === "super" ? "text-purple-600" : "text-green-600"
                        }`} />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800">Staff & Instructors</h4>
                        <p className="text-sm text-gray-500">Who visitors can request to meet</p>
                      </div>
                    </div>
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                      editData.role === "super" 
                        ? "bg-purple-100 text-purple-600" 
                        : "bg-green-100 text-green-600"
                    }`}>
                      {editData.staffToVisit.length} added
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={editNewStaff}
                          onChange={(e) => handleEditStaffInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addStaffToEditList()}
                          className={`w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 transition-all uppercase ${
                            editData.role === "super" 
                              ? "border-purple-300 focus:border-purple-500 focus:ring-purple-500/20" 
                              : "border-gray-300 focus:border-green-500 focus:ring-green-500/20"
                          }`}
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
                        className={`px-6 py-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium ${
                          editData.role === "super"
                            ? "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                            : "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                        } text-white`}
                      >
                        <Plus size={18} />
                        Add
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {editData.staffToVisit.map((staff) => (
                        <div 
                          key={staff.id} 
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:scale-[1.02] ${
                            editData.role === "super"
                              ? "bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700"
                              : "bg-gradient-to-r from-green-50 to-green-100 text-green-700"
                          }`}
                        >
                          <UserPlus size={14} className="flex-shrink-0" />
                          <span className="font-medium">{staff.name}</span>
                          <button
                            type="button"
                            onClick={() => removeStaffFromEditList(staff.id)}
                            className={`ml-1 transition-colors ${
                              editData.role === "super"
                                ? "text-purple-400 hover:text-purple-600"
                                : "text-green-400 hover:text-green-600"
                            }`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-6 border-t border-gray-200">
                  <button 
                    onClick={saveEdit} 
                    disabled={editLoading}
                    className={`w-full py-4 rounded-xl transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group ${
                      editData.role === "super"
                        ? "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                        : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                    } text-white`}
                  >
                    {editLoading ? (
                      <span className="flex items-center justify-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                        Saving Changes...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-3">
                        <Check size={20} />
                        {editData.role === "super" ? "UPDATE SUPER ADMIN" : "UPDATE OFFICE"}
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
                    <div className="font-medium">
                      <span className={`text-[10px] font-medium tracking-wider px-2 py-1 rounded-full border ${
                        offices[deleteIndex]?.role === "super" 
                          ? "bg-purple-50 text-purple-700 border-purple-200" 
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}>
                        {offices[deleteIndex]?.role === "super" ? "SUPER ADMIN" : "OFFICE ADMIN"}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded border text-center">
                    <div className="text-gray-500">Created</div>
                    <div className="font-medium">
                      {(() => {
                        const timestamp = offices[deleteIndex]?.createdAt;
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
                          if (!date || isNaN(date.getTime())) return "Just now";
                          return date.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          });
                        } catch (error) {
                          return "Just now";
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning Message - Special message for super admin */}
              {offices[deleteIndex]?.role === "super" ? (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <Shield className="w-5 h-5 text-purple-600 mt-0.5 mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-purple-800 mb-1">Super Admin Protected</p>
                      <p className="text-sm text-purple-700">
                        Super Admin accounts cannot be deleted from this interface. 
                        This account is protected and required for system administration.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
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
              )}

              {/* Extra Confirmation for Safety - Only show for non-super admin */}
              {offices[deleteIndex]?.role !== "super" && (
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
              )}

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
                
                {offices[deleteIndex]?.role === "super" ? (
                  <button 
                    onClick={() => {
                      alert("Super Admin accounts cannot be deleted. This account is protected.");
                      setDeleteIndex(null);
                      setDeleteConfirmed(false);
                    }}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium rounded-lg transition duration-200 flex items-center justify-center gap-2 cursor-not-allowed opacity-50"
                  >
                    <Shield size={18} />
                    Protected
                  </button>
                ) : (
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
                )}
              </div>
            </div>
           </div>
        </div>
      )}
    </div>
  );
};
 
export default Offices;
