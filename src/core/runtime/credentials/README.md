# Runtime Credentials

Runtime credentials own provider credential source selection for generic agent
execution.

`RuntimeCredentialService` decides whether a model will use an explicit API key,
an environment API key, a stored OAuth credential, or no available credential.
Callers should resolve this once at their owning runtime boundary and pass the
concrete result downward.
