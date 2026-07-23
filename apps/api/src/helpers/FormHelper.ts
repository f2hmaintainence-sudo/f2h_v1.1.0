/**
 * FormHelper
 *
 * Dynamic form configuration engine â€” mirrors TableHelper for tables.
 * Takes a FormSet config and returns a standardized FormResponse
 * that SkeletonForm can render as a popup.
 *
 * Handles:
 *  1. generateResponse  â€“ builds FormResponse from FormSet config
 *  2. mergeData         â€“ pre-fills field values for edit mode
 *  3. validateFields    â€“ server-side field validation
 */

import { Injectable, Logger } from '@nestjs/common';

export interface ValidationRule {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  message?: string;
}

export interface FieldDef {
  /** DB column name / form field key */
  name: string;
  /** Display label */
  label?: string;
  /** Input type */
  type:
  | 'text'
  | 'number'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'select'
  | 'date'
  | 'toggle'
  | 'hidden'
  | 'password'
  | 'file'
  | 'time'
  | 'html';
  /** Whether field is required */
  required?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Default or pre-filled value */
  defaultValue?: any;
  /** Static options for select/radio fields */
  options?: { value: string; label: string }[];
  /** Dynamic options endpoint (fetched by SkeletonForm at runtime) */
  optionsEndpoint?: string;
  /** Validation rules (sent to frontend + enforced on backend) */
  validation?: ValidationRule;
  /** Layout hint: 'full' = full row, 'half' = side-by-side, 'third' = three per row, 'quarter' = four per row */
  width?: 'full' | 'half' | 'third' | 'quarter';
  /** Whether field is disabled */
  disabled?: boolean;
  /** Show this field only when another field equals a specific value */
  visibleWhen?: { field: string; value: any };
  /** Whether field is visible (false = hidden field, still submitted) */
  visible?: boolean;
  /** Group name for sectioned forms */
  group?: string;
  /** Description or sublabel shown under the field label */
  description?: string;
  /** Prefix text/symbol displayed inside or beside input (e.g. ₹) */
  prefix?: string;
  /** Custom options for toggle switch display */
  toggleOptions?: { onLabel?: string; offLabel?: string; pill?: boolean };
  /** Accepted file MIME types/extensions for file inputs */
  accept?: string;
  /** Enable client-side crop UI for image file fields */
  crop?: boolean;
  /** Crop output aspect ratio, e.g. 1 for square */
  aspectRatio?: number;
  /** Crop output width in pixels */
  cropWidth?: number;
  /** Crop output height in pixels */
  cropHeight?: number;
  /** Allow multiple files selection */
  multiple?: boolean;
}

export interface FormSet {
  /** Popup title ("Add Customer", "Edit Customer") */
  title: string;
  /** Optional subtitle displayed below title (e.g. partner name) */
  subtitle?: string;
  /** Optional modal max width (e.g. "480px") */
  maxWidth?: string;
  /** Array of field definitions */
  fields: FieldDef[] | FieldDef[][];
  /** Submit button label */
  submitLabel?: string;
  /** Pre-filled data for edit mode */
  data?: Record<string, any>;
  script: string;
}

export interface FormResponse {
  status: boolean;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  fields: FieldDef[];
  data: Record<string, any>;
  submitLabel: string;
  message: string;
  script: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

// â”€â”€â”€ Injectable Service â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@Injectable()
export class FormHelper {
  private readonly logger = new Logger(FormHelper.name);

  // â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• 
  // 1. generateResponse â€” builds FormResponse from config
  // â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• 

  generateResponse(set: FormSet): FormResponse {
    // Helper function to normalize a single field object
    const normalize = (field: any) => ({
      ...field,
      visible: field.visible !== false,
      width: field.width ?? 'full',
      required: field.required ?? false,
      disabled: field.disabled ?? false,
    });

    // Check if we are dealing with a Stepper (Array of Arrays)
    const isStepper = Array.isArray(set.fields[0]);

    let processedFields;

    if (isStepper) {
      // Loop through each step, then normalize fields within that step
      processedFields = (set.fields as any[][]).map((step) =>
        step.map((field) => normalize(field)),
      );
    } else {
      // Standard single-array logic
      processedFields = (set.fields as any[]).map((field) => normalize(field));
    }

    // Pre-fill field defaultValues from data if available
    const data = set.data ?? {};

    // Note: Ensure your mergeData method is updated to handle nested arrays if using steppers
    const mergedFields = this.mergeData(processedFields, data);

    return {
      status: true,
      title: set.title,
      subtitle: set.subtitle,
      maxWidth: set.maxWidth,
      fields: mergedFields,
      data,
      submitLabel: set.submitLabel ?? 'Save',
      message: 'Form loaded successfully',
      script: set.script,
    };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // 2. mergeData â€” pre-fill field values for edit mode
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  private mergeData(fields: FieldDef[], data: Record<string, any>): FieldDef[] {
    if (!data || Object.keys(data).length === 0) return fields;

    return fields.map((field) => {
      const value = data[field.name];
      if (value !== undefined && value !== null) {
        return { ...field, defaultValue: value };
      }
      return field;
    });
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // 3. validateFields â€” server-side validation using field defs
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  validateFields(
    fields: FieldDef[],
    body: Record<string, any>,
  ): ValidationResult {
    const errors: Record<string, string> = {};

    for (const field of fields) {
      const value = body[field.name];
      const isEmpty =
        value === undefined || value === null || String(value).trim() === '';

      // Required check
      if (field.required && isEmpty) {
        errors[field.name] = `${field.label} is required`;
        continue;
      }

      // Skip further validation if empty and not required
      if (isEmpty) continue;

      const v = field.validation;
      if (!v) continue;

      const strValue = String(value);

      // String length checks
      if (v.minLength && strValue.length < v.minLength) {
        errors[field.name] =
          v.message ??
          `${field.label} must be at least ${v.minLength} characters`;
        continue;
      }
      if (v.maxLength && strValue.length > v.maxLength) {
        errors[field.name] =
          v.message ??
          `${field.label} must not exceed ${v.maxLength} characters`;
        continue;
      }

      // Number range checks
      if (field.type === 'number') {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          errors[field.name] = `${field.label} must be a valid number`;
          continue;
        }
        if (v.min !== undefined && numValue < v.min) {
          errors[field.name] =
            v.message ?? `${field.label} must be at least ${v.min}`;
          continue;
        }
        if (v.max !== undefined && numValue > v.max) {
          errors[field.name] =
            v.message ?? `${field.label} must not exceed ${v.max}`;
          continue;
        }
      }

      // Pattern check (regex)
      if (v.pattern) {
        try {
          if (!new RegExp(v.pattern).test(strValue)) {
            errors[field.name] =
              v.message ?? `${field.label} has invalid format`;
          }
        } catch {
          this.logger.warn(
            `Invalid regex pattern for field ${field.name}: ${v.pattern}`,
          );
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
