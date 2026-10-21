'use client';

import React, { useState } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

const InputField = ({
  name,
  label,
  placeholder,
  type = 'text',
  register,
  error,
  validation,
  disabled = false,
  value,
  className,
  style,
}: FormInputProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={cn('space-y-1.5', className)} style={style}>
      <Label htmlFor={name} className="form-label">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={name}
          type={inputType}
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          className={cn('form-input', isPassword && 'pr-11', {
            'opacity-50 cursor-not-allowed': disabled,
          })}
          {...register(name, validation)}
        />
        {isPassword && (
          <button
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 hover:text-ink"
          >
            {showPassword ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.5} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.5} />}
          </button>
        )}
      </div>
      {error && <p className="text-[13px] text-down">{error.message || 'Check this field'}</p>}
    </div>
  );
};

export default InputField;
