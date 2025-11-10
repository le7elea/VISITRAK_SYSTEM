import React from "react";
import { Copyright } from "lucide-react";

const Footer = () => {
  return (
    <footer className="mt-10 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f1f1f] text-center">
      <div className="flex justify-center items-center text-sm text-gray-500 dark:text-gray-400">
        <Copyright className="w-4 h-4 mr-1" />
        <span>2025 LMT. All rights reserved.</span>
      </div>
    </footer>
  );
};

export default Footer;
