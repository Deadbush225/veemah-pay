"use client";
import { useState } from 'react';

interface PasswordInputProps {
  id?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  maxLength?: number;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
}

export function PasswordInput({
  id,
  placeholder = "Password",
  value,
  onChange,
  onKeyDown,
  maxLength,
  style,
  className = "",
  disabled = false
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className={`password-input-container ${className}`} style={style}>
      <input
        id={id}
        type={showPassword ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={maxLength}
        disabled={disabled}
        className="password-input"
      />
      <button
        type="button"
        className={`password-toggle-btn ${showPassword ? 'showing' : 'hiding'}`}
        onClick={togglePasswordVisibility}
        disabled={disabled}
        aria-label={showPassword ? "Hide password" : "Show password"}
        title={showPassword ? "Hide password" : "Show password"}
      >
        <span className={`eye-icon ${showPassword ? 'eye-open' : 'eye-closed'}`}>
          {showPassword ? '👁️' : '👁️‍🗨️'}
        </span>
      </button>
    </div>
  );
}