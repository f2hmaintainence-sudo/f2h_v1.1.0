# Frontend-Backend Dynamic Workflow (Form2Home Admin Panel)

This document outlines the standard data flow between the Frontend (`.tsx` components) and the Backend API for the Admin Panel. The Form2Home architecture uses a highly dynamic, metadata-driven approach where the Backend dictates the UI structure (table columns, form fields) rather than hardcoding them in the frontend.

## 1. Data Table Workflow

**Goal**: Display a list of records with sorting, pagination, and dynamic action buttons.

```mermaid
sequenceDiagram
    participant Frontend as Frontend (.tsx)
    participant Controller as Controller (API)
    participant TableSvc as TableService
    participant TableHelper as TableHelper
    participant Database as Database

    Frontend->>Controller: GET /api/v1/module/table?page=1&limit=10
    Controller->>TableSvc: getModuleTable(query)
    TableSvc->>TableHelper: define columns, joins, conditions
    TableHelper->>Database: Execute SQL Query
    Database-->>TableHelper: Return Raw Data rows
    TableHelper-->>TableSvc: Generate TableResponse (Columns schema + Data)
    TableSvc-->>Controller: Return JSON
    Controller-->>Frontend: JSON Response
    Frontend->>Frontend: Render Dynamic Table based on Columns schema
```

## 2. Show Add Form Workflow

**Goal**: Display a dynamic form for creating a new record.

```mermaid
sequenceDiagram
    participant Frontend as Frontend (.tsx)
    participant Controller as Controller (API)
    participant ShowAddSvc as ShowAddService
    participant FormHelper as FormHelper

    Frontend->>Frontend: User clicks "Add New"
    Frontend->>Controller: GET /api/v1/module/showAdd
    Controller->>ShowAddSvc: getModuleForm()
    ShowAddSvc->>ShowAddSvc: Define FieldDefs (name, type, validation, width)
    ShowAddSvc->>FormHelper: generateResponse({ title, fields, submitLabel })
    FormHelper-->>ShowAddSvc: FormResponse Schema
    ShowAddSvc-->>Controller: Return JSON
    Controller-->>Frontend: JSON Schema
    Frontend->>Frontend: Render Dynamic Form elements based on FieldDefs
```

## 3. Save Add (Create) Workflow

**Goal**: Submit the newly filled form data to create a record in the database.

```mermaid
sequenceDiagram
    participant Frontend as Frontend (.tsx)
    participant Controller as Controller (API)
    participant SaveAddSvc as SaveAddService
    participant FormHelper as FormHelper
    participant Database as Database

    Frontend->>Frontend: User clicks Submit
    Frontend->>Controller: POST /api/v1/module/saveAdd (Payload)
    Controller->>SaveAddSvc: saveModule(body, adminId)
    SaveAddSvc->>FormHelper: validateFields(fields, body)
    FormHelper-->>SaveAddSvc: Validation result (Valid/Errors)
    
    alt Validation Failed
        SaveAddSvc-->>Controller: Throw BadRequestException
        Controller-->>Frontend: 400 Bad Request + Validation Errors
        Frontend->>Frontend: Display Error Text under specific fields
    else Validation Passed
        SaveAddSvc->>Database: insert('module_table', parsedData)
        Database-->>SaveAddSvc: Insert Success
        SaveAddSvc->>Database: insert('audit_logs', { action: 'create' })
        SaveAddSvc-->>Controller: Return { status: true, message: 'Success' }
        Controller-->>Frontend: 200 OK
        Frontend->>Frontend: Close Modal / Redirect & Refresh Table
    end
```

## 4. Show Edit Form Workflow

**Goal**: Load an existing record into a dynamic form for editing.

```mermaid
sequenceDiagram
    participant Frontend as Frontend (.tsx)
    participant Controller as Controller (API)
    participant ShowEditSvc as ShowEditService
    participant FormHelper as FormHelper
    participant Database as Database

    Frontend->>Frontend: User clicks "Edit" action on Table row
    Frontend->>Controller: GET /api/v1/module/:id/showEdit
    Controller->>ShowEditSvc: getModuleEditForm(id)
    
    ShowEditSvc->>Database: query('module_table', { where id })
    Database-->>ShowEditSvc: Return existing record data
    
    ShowEditSvc->>ShowEditSvc: Fetch identical FieldDefs from ShowAddService
    ShowEditSvc->>FormHelper: generateResponse({ fields, data: existingRecord })
    FormHelper-->>ShowEditSvc: FormResponse Schema (with pre-filled data)
    ShowEditSvc-->>Controller: Return JSON
    Controller-->>Frontend: JSON Schema + Pre-filled values
    Frontend->>Frontend: Render Dynamic Form, populate fields with existing data
```

## 5. Save Edit (Update) Workflow

**Goal**: Submit the modified form data to update an existing record.

```mermaid
sequenceDiagram
    participant Frontend as Frontend (.tsx)
    participant Controller as Controller (API)
    participant SaveEditSvc as SaveEditService
    participant FormHelper as FormHelper
    participant Database as Database

    Frontend->>Frontend: User modifies data and clicks Update
    Frontend->>Controller: POST /api/v1/module/:id/saveEdit (Payload)
    Controller->>SaveEditSvc: saveModule(id, body, adminId)
    
    SaveEditSvc->>FormHelper: validateFields(fields, body)
    FormHelper-->>SaveEditSvc: Validation result
    
    alt Validation Failed
        SaveEditSvc-->>Controller: Throw BadRequestException
        Controller-->>Frontend: 400 Bad Request
    else Validation Passed
        SaveEditSvc->>SaveEditSvc: Filter only allowed update fields
        SaveEditSvc->>Database: update('module_table', updatedData, { where id })
        Database-->>SaveEditSvc: Update Success
        SaveEditSvc->>Database: insert('audit_logs', { action: 'update', changes })
        SaveEditSvc-->>Controller: Return { status: true, message: 'Updated' }
        Controller-->>Frontend: 200 OK
        Frontend->>Frontend: Close Modal / Redirect & Refresh Table
    end
```

## 6. Delete (Soft Delete) Workflow

**Goal**: Remove a record from the table.

```mermaid
sequenceDiagram
    participant Frontend as Frontend (.tsx)
    participant Controller as Controller (API)
    participant MainSvc as Main Service
    participant Database as Database

    Frontend->>Frontend: User clicks "Delete" action on Table row
    Frontend->>Frontend: System prompts "Are you sure?"
    Frontend->>Controller: DELETE /api/v1/module/:id/delete
    Controller->>MainSvc: softDeleteModule(id, adminId)
    
    MainSvc->>Database: update('module_table', { deleted_at: timestamp })
    Database-->>MainSvc: Success
    MainSvc->>Database: insert('audit_logs', { action: 'soft_delete' })
    MainSvc-->>Controller: Return { status: true, message: 'Deleted' }
    
    Controller-->>Frontend: 200 OK
    Frontend->>Frontend: Display Toast Notification & Refresh Table
```

## Summary of the Code Flow Architecture

1. **Routing**: The frontend makes requests via RTK Query or Axios based on the current page context.
2. **Controller (`.controller.ts`)**: Acts as the entry point. It receives the HTTP request, extracts the `Body`, `Query`, `Param`, and `Req.user` context, and passes it to the corresponding service.
3. **Table & Form Schema Services (`table.service.ts`, `showAdd.service.ts`, `showEdit.service.ts`)**: These services do not typically mutate database state. Their primary job is generating JSON definitions (using `TableHelper` and `FormHelper`) that instruct the Frontend on exactly **what** to render.
4. **Mutation Services (`saveAdd.service.ts`, `saveEdit.service.ts`, `main.service.ts`)**: These services handle validation, database transactions (`insert`, `update`), and writing to the `audit_logs` table for tracking administrative actions. They respond with success/error statuses that the frontend uses to display toast notifications.
