# Arquitectura

Complementa a [`requisitos.md`](requisitos.md) (qué debe hacer el sistema) y a
[`openapi.yaml`](openapi.yaml) (el contrato de la API). Las decisiones y sus alternativas están en
los [ADR](adr/README.md).

## 1. Casos de uso

```mermaid
flowchart LR
    P([Practicante])
    A([Analista])

    subgraph Sistema
        UC1[Registrar postulación<br/>RF-01 a RF-04]
        UC2[Iniciar / cerrar sesión<br/>RF-05]
        UC3[Listar y filtrar postulaciones<br/>RF-06, RF-11]
        UC4[Ver detalle<br/>RF-07]
        UC5[Marcar viable / no viable<br/>RF-08]
        UC6[Ver bitácora de decisiones<br/>RF-10]
        UC7[Descargar hoja de vida<br/>RF-09]
    end

    P --> UC1
    A --> UC2
    A --> UC3
    A --> UC4
    A --> UC5
    A --> UC6
    A --> UC7
```

## 2. Componentes y capas

Una sola aplicación Node.js sirve el frontend y la API. Cada capa solo conoce a la de abajo; las
[pruebas de arquitectura](../tests/unit/architecture.test.js) fallan si esa regla se rompe (RNF-13).

```mermaid
flowchart TB
    subgraph Navegador
        FE["Frontend (public/)<br/>HTML + CSS + JS sin framework<br/>validation.js · dom.js · api.js"]
    end

    subgraph Servidor["Servidor Express (src/)"]
        MW["Middleware<br/>cabeceras de seguridad · sesión · validador OpenAPI"]
        R["Rutas (routes/)<br/>solo HTTP"]
        S["Servicios (services/)<br/>reglas de negocio · sin Express"]
        REPO["Repositorios (repositories/)<br/>SQL parametrizado"]
        EH["Manejo de errores<br/>formato uniforme (RNF-15)"]
    end

    DB[("SQLite<br/>data/app.sqlite")]
    FS[("Hojas de vida<br/>uploads/ (privada)")]
    C[["docs/openapi.yaml"]]

    FE -- "fetch JSON / multipart<br/>cookie sid" --> MW
    C -. valida peticiones y respuestas .-> MW
    MW --> R --> S --> REPO --> DB
    S --> FS
    R -. errores .-> EH
```

## 3. Modelo de datos

Las restricciones de la base de datos repiten las reglas de negocio principales como defensa en
profundidad: aunque una capa superior fallara, la base de datos rechaza datos inválidos.

```mermaid
erDiagram
    ANALYSTS ||--o{ STATUS_CHANGES : "toma"
    APPLICANTS ||--o{ STATUS_CHANGES : "recibe"

    ANALYSTS {
        integer id PK
        text username UK
        text password_hash "bcrypt (RNF-01)"
        text created_at
    }

    APPLICANTS {
        integer id PK
        text full_name
        text email UK "COLLATE NOCASE (RF-04)"
        text career
        integer semester "CHECK 1..12"
        text cv_file_name UK "UUID (RNF-03)"
        text status "PENDIENTE | VIABLE | NO_VIABLE"
        text data_consent_at "Ley 1581 (RNF-09)"
        text created_at
        text updated_at
    }

    STATUS_CHANGES {
        integer id PK
        integer applicant_id FK
        text previous_status
        text new_status "VIABLE | NO_VIABLE"
        integer changed_by FK
        text changed_at
    }
```

## 4. Secuencia: registro de una postulación

El archivo se mantiene en memoria hasta pasar todas las validaciones: una postulación rechazada
nunca deja archivos en el disco.

```mermaid
sequenceDiagram
    actor P as Practicante
    participant FE as Formulario
    participant V as Validador OpenAPI
    participant S as applicantService
    participant FS as uploads/
    participant DB as SQLite

    P->>FE: Completa y envía
    FE->>FE: Validación en el navegador (RF-02)
    alt Hay errores
        FE-->>P: Error junto a cada campo
    else Válido
        FE->>V: POST /api/applicants (multipart)
        V->>V: Estructura, tipos, tamaño ≤ 5 MB
        V->>S: Petición válida + archivo en memoria
        S->>S: Reglas de negocio + firma %PDF- (RF-03, RNF-04)
        S->>DB: ¿Existe el correo? (RF-04)
        S->>FS: Guarda <uuid>.pdf
        S->>DB: INSERT applicant
        alt Otro registro ganó la carrera (UNIQUE)
            S->>FS: Elimina el archivo
            S-->>FE: 409 DUPLICATE_EMAIL
        else
            S-->>FE: 201 { id, status: PENDIENTE }
            FE-->>P: Confirmación
        end
    end
```

## 5. Secuencia: decisión del analista

```mermaid
sequenceDiagram
    actor A as Analista
    participant FE as Panel
    participant R as Rutas
    participant S as applicantService
    participant DB as SQLite

    A->>FE: "Marcar como viable"
    FE->>R: PUT /api/applicants/{id}/status (cookie sid)
    R->>R: requireAuth (RNF-02)
    R->>S: changeStatus(id, VIABLE, analista)
    S->>DB: BEGIN
    S->>DB: Estado actual
    alt Mismo estado
        S->>DB: COMMIT (sin cambios ni registro)
    else Estado distinto
        S->>DB: UPDATE applicants
        S->>DB: INSERT status_changes (RF-10)
        S->>DB: COMMIT
    end
    S-->>FE: 200 practicante actualizado
    FE-->>A: Aviso + lista y bitácora actualizadas
```
