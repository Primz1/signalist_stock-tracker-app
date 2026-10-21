import { Label } from "@/components/ui/label";
import React from 'react'
import { Controller } from 'react-hook-form'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"


const SelectField = ({ name, label, placeholder, options, control, error, required = false }: SelectFieldProps) => {
    return (
        <div className='space-y-2'>
            <Label htmlFor={name} className='form-label'>
                {label}
            </Label>
            <Controller
                name={name}
                control={control}
                rules={{
                    required: required ? `Please select ${label.toLowerCase()}` : false,
                }}
                render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="select-trigger">
                            <SelectValue placeholder={placeholder} />
                        </SelectTrigger>
                        <SelectContent className="border-line-strong bg-surface text-ink">
                            {options.map((option) => (
                                <SelectItem value={option.value} key={option.value} className="cursor-pointer focus:bg-surface-2 focus:text-ink">
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                        {error && <p className='mt-1 text-[13px] text-down'>{error.message}</p>}
                    </Select>

                )}
            />
        </div>
    )
}

export default SelectField