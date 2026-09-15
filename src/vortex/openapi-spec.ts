/**
 * OpenAPI 3.0.3 Specification for Vortex Universal Agent (VUA)
 * Conforming to VUA-SPEC-v2 & Vortex Foundation Governance Profiles
 * Complete & Exhaustive API Spec for all endpoints, MCP tools, and universal adapters
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Vortex Universal Agent (VUA) Governance API",
    version: "2.5.0",
    description: `API de governança criptográfica, adaptadores universais multi-plataforma e runtime agêntico do **Vortex Universal Agent (VUA)**.
Thesis: **SAFETY = AUTHORIZATION + BOUNDED EXECUTION + ACCOUNTABILITY + INDEPENDENT VERIFICATION + IDENTITY**.

Todos os endpoints operam sob princípios de fail-closed, provas criptográficas Ed25519 (RFC 8785 canonical JSON), mitigação anti-replay, isolamento sandbox e subjeção universal.`,
    contact: {
      name: "Vortex Foundation",
      url: "https://github.com/vuafoundation/vua"
    },
    license: {
      name: "Apache-2.0",
      url: "https://www.apache.org/licenses/LICENSE-2.0.html"
    }
  },
  servers: [
    {
      url: "/",
      description: "Servidor Atual VUA Runtime (Produção / Desenvolvimento)"
    }
  ],
  tags: [
    { name: "Core & Health", description: "Saúde da plataforma, métricas do runtime e descoberta RFC de chaves públicas" },
    { name: "Firebase Auth & Cloud Ledger", description: "Autenticação via tokens JWT do Firebase Auth (Google Sign-In), verificação de claims de operador, papéis ABAC e persistência durável no Firestore" },
    { name: "MCP Protocol & Streaming", description: "Protocolo Model Context Protocol (JSON-RPC 2.0, SSE Streaming e ferramentas)" },
    { name: "Governance & Pipeline", description: "Execução governada em 5 estágios, verificação de provas Ed25519 e suítes de conformidade" },
    { name: "Storage & Evidence (GOS3)", description: "Governed Object Storage v3, sessões com hash de integridade e rotação de chaves" },
    { name: "Multi-LLM Gateway", description: "Inferência multi-provedor governada (Gemini, OpenAI, Ollama, LM Studio, LlamaCpp)" },
    { name: "Agent Patch Arena", description: "Torneios darwinianos de patches, avaliação canária e governança Intent-Aware" },
    { name: "Universal Adapters", description: "Conectores universais de plataforma (Linux Host, Android/ADB, Windows/PowerShell, GitHub)" },
    { name: "GitHub Connector (Git Full)", description: "Integração governada completa de VCS: branches, commits assinados, PRs, merges e CI" }
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Core & Health"],
        summary: "Verificação de integridade e tese do runtime",
        description: "Retorna o status do servidor, versão do Node.js, especificação de governança ativa e a tese fundamental do Vortex.",
        responses: {
          "200": {
            description: "Servidor saudável",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    service: { type: "string", example: "vortex-mcp-foundation-server" },
                    spec: { type: "string", example: "Vortex MCP Execution Governance Profile v1" },
                    thesis: { type: "string", example: "SAFETY = AUTHORIZATION + BOUNDED EXECUTION + ACCOUNTABILITY + INDEPENDENT VERIFICATION + IDENTITY" },
                    node_version: { type: "string", example: "v22.14.0" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/.well-known/vortex-keys": {
      get: {
        tags: ["Core & Health"],
        summary: "Descoberta RFC de chaves públicas Ed25519",
        description: "Lista todas as chaves públicas ativas no registro criptográfico para validação descentralizada de provas de execução.",
        responses: {
          "200": {
            description: "Lista de chaves públicas registradas",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    keys: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          key_id: { type: "string", example: "key-vortex-root-primary" },
                          algorithm: { type: "string", example: "Ed25519" },
                          principal_id: { type: "string", example: "principal-vortex-gateway-001" },
                          public_key_hex: { type: "string", example: "d82e811c471029c8e8113bba4d29381ea610cf91a82e9b01239ab81efccaa892" },
                          created_at: { type: "string", format: "date-time" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/mcp": {
      get: {
        tags: ["MCP Protocol & Streaming"],
        summary: "Conexão SSE para streaming MCP ou inspeção JSON",
        description: "Se chamado com cabeçalho `Accept: text/event-stream`, estabelece canal Server-Sent Events (SSE). Caso contrário, retorna metadados do protocolo MCP e a lista de ferramentas.",
        responses: {
          "200": {
            description: "Fluxo SSE inicializado ou metadados de protocolo",
            content: {
              "text/event-stream": {},
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    service: { type: "string", example: "vua-mcp-server" },
                    version: { type: "string", example: "1.0.0" },
                    status: { type: "string", example: "ONLINE" },
                    protocol: { type: "string", example: "MCP JSON-RPC 2.0" },
                    transports: { type: "array", items: { type: "string" } },
                    tools_count: { type: "number", example: 8 },
                    tools: {
                      type: "array",
                      items: { type: "string" },
                      example: ["vortex.inspect", "vortex.propose", "vortex.verify", "vortex.execute", "vortex.branch.write", "vortex.llm.invoke", "vua.adapters.list", "vua.adapter.invoke"]
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ["MCP Protocol & Streaming"],
        summary: "Despacho direto de JSON-RPC 2.0 MCP",
        description: "Executa mensagens diretas do protocolo Model Context Protocol (methods: `tools/list`, `tools/call`, `initialize`).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  jsonrpc: { type: "string", example: "2.0" },
                  id: { oneOf: [{ type: "string" }, { type: "number" }], example: "req-01" },
                  method: { type: "string", example: "tools/call" },
                  params: {
                    type: "object",
                    properties: {
                      name: { type: "string", example: "vortex.inspect" },
                      arguments: { type: "object" }
                    }
                  }
                },
                required: ["jsonrpc", "method"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Resposta JSON-RPC 2.0 com resultado ou erro",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    jsonrpc: { type: "string", example: "2.0" },
                    id: { oneOf: [{ type: "string" }, { type: "number" }] },
                    result: { type: "object" },
                    error: { type: "object" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/sse": {
      get: {
        tags: ["MCP Protocol & Streaming"],
        summary: "Endpoint dedicado Server-Sent Events (SSE)",
        description: "Canal permanente de streaming para clientes MCP compatíveis (Claude Desktop, Cursor, Claude Mobile). Mantém heartbeat de 15s.",
        responses: {
          "200": {
            description: "Fluxo SSE contínuo de eventos",
            content: {
              "text/event-stream": {}
            }
          }
        }
      }
    },
    "/mcp/messages": {
      post: {
        tags: ["MCP Protocol & Streaming"],
        summary: "Envio de comandos vinculados à sessão SSE",
        description: "Recebe comandos JSON-RPC 2.0 associados ao parâmetro `sessionId` obtido via SSE.",
        parameters: [
          {
            name: "sessionId",
            in: "query",
            description: "Identificador de sessão retornado no handshake SSE",
            required: false,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object" }
            }
          }
        },
        responses: {
          "200": { description: "Mensagem processada e retornada inline ou despachada pelo canal SSE" },
          "202": { description: "Mensagem aceita na sessão" }
        }
      }
    },
    "/messages": {
      post: {
        tags: ["MCP Protocol & Streaming"],
        summary: "Alias alternativo de /mcp/messages",
        description: "Compatibilidade reversa com clientes MCP legados que invocam /messages diretamente.",
        parameters: [
          {
            name: "sessionId",
            in: "query",
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { type: "object" } }
          }
        },
        responses: {
          "200": { description: "Mensagem processada" }
        }
      }
    },
    "/api/vortex/status": {
      get: {
        tags: ["Governance & Pipeline"],
        summary: "Status geral do pipeline e identidade ativa",
        description: "Exibe chave criptográfica Ed25519 ativa, estado do GOS3, políticas aplicadas e histórico recente de execuções.",
        responses: {
          "200": {
            description: "Status completo do gateway",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    active_identity: { $ref: "#/components/schemas/CryptographicIdentity" },
                    total_executions: { type: "number" },
                    recent_executions: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ExecutionProof" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/vortex/execute": {
      post: {
        tags: ["Governance & Pipeline"],
        summary: "Execução governada em 5 estágios",
        description: "Submete operação aos 5 estágios normativos: Inspect, Propose, Verify, Execute, Branch Write com emissão de ExecutionProof v1 assinado com Ed25519.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  command: { type: "string", example: "inspect_tree" },
                  args: { type: "object" },
                  scope: { type: "string", example: "repo:read" },
                  target_branch: { type: "string", example: "main" },
                  human_approval: { type: "boolean", default: false }
                },
                required: ["command", "scope"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Execução governada concluída com sucesso",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    stage: { type: "string" },
                    proof: { $ref: "#/components/schemas/ExecutionProof" },
                    execution_log: { type: "object" }
                  }
                }
              }
            }
          },
          "403": { description: "Falha de autorização, violação de sandbox ou escopo negado (Fail-Closed)" }
        }
      }
    },
    "/api/vortex/verify": {
      post: {
        tags: ["Governance & Pipeline"],
        summary: "Verificação independente de prova de execução",
        description: "Auditoria matemática de assinaturas Ed25519, canonicalização RFC 8785 (JCS) e limites temporais.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  proof: { $ref: "#/components/schemas/ExecutionProof" }
                },
                required: ["proof"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Resultado da auditoria independente",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    valid: { type: "boolean", example: true },
                    verification_time_ms: { type: "number", example: 1.2 },
                    checks: {
                      type: "object",
                      properties: {
                        signature: { type: "boolean", example: true },
                        canonical_hash: { type: "boolean", example: true },
                        replay_safe: { type: "boolean", example: true }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/vortex/conformance/adversarial": {
      post: {
        tags: ["Governance & Pipeline"],
        summary: "Dispara suíte de ataques adversários",
        description: "Testa contenção de falsificação de assinatura, ataques de replay, escalonamento de privilégio, escape de sandbox e adulteração de payloads.",
        responses: {
          "200": { description: "Suíte executada com relatório de contenção (5/5 PASS)" }
        }
      }
    },
    "/api/vortex/conformance/e2e": {
      post: {
        tags: ["Governance & Pipeline"],
        summary: "Executa suíte de conformidade Foundation 10/10",
        description: "Executa os 10 fluxos de ponta a ponta requeridos pela especificação oficial do Vortex.",
        responses: {
          "200": { description: "Relatório de conformidade ponta a ponta 100% PASS" }
        }
      }
    },
    "/api/vortex/evidence": {
      get: {
        tags: ["Storage & Evidence (GOS3)"],
        summary: "Recupera evidência criptográfica consolidada",
        description: "Retorna a evidência consolidada em formato RFC 8785 com canonical_hash e assinatura do auditor.",
        responses: {
          "200": { description: "Evidência ativa" }
        }
      }
    },
    "/api/vortex/gos3/session": {
      post: {
        tags: ["Storage & Evidence (GOS3)"],
        summary: "Abre sessão no Governed Object Storage (GOS3)",
        description: "Registra sessão para acesso a objeto com verificação de cabeçalho de contrato e hash SHA-256.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  resource_uri: { type: "string", example: "gos3://vortex-vault/secrets/agent.env" },
                  principal: { type: "string", example: "agent-gemini-pro" }
                },
                required: ["resource_uri", "principal"]
              }
            }
          }
        },
        responses: {
          "200": { description: "Sessão GOS3 criada" }
        }
      }
    },
    "/api/vortex/gos3/sessions": {
      get: {
        tags: ["Storage & Evidence (GOS3)"],
        summary: "Lista sessões ativas do GOS3",
        description: "Retorna o inventário de sessões abertas no armazenamento governado.",
        responses: {
          "200": { description: "Sessões ativas" }
        }
      }
    },
    "/api/vortex/keys/rotate": {
      post: {
        tags: ["Storage & Evidence (GOS3)"],
        summary: "Rotaciona par de chaves Ed25519",
        description: "Gera novo par de chaves Ed25519 e arquiva a chave anterior no registro de chaves históricas.",
        responses: {
          "200": { description: "Chave rotacionada com sucesso" }
        }
      }
    },
    "/api/vortex/reset-replay": {
      post: {
        tags: ["Storage & Evidence (GOS3)"],
        summary: "Limpa cache anti-replay",
        description: "Redefine a tabela de nonces para ambientes de teste e reinício de ciclo de homologação.",
        responses: {
          "200": { description: "Cache de replay redefinido" }
        }
      }
    },
    "/api/vortex/arena/tournament": {
      get: {
        tags: ["Agent Patch Arena"],
        summary: "Consulta leaderboard e histórico da Arena",
        description: "Retorna o último estado do torneio darwiniano de patches com ganhos delta sobre baseline e métricas por agente.",
        responses: {
          "200": { description: "Leaderboard atualizado da Arena" }
        }
      },
      post: {
        tags: ["Agent Patch Arena"],
        summary: "Executa torneio de patches com governança Intent-Aware",
        description: "Submete candidatos de patches a testes de Canary, acurácia e benchmarks de performance, aplicando tolerâncias conforme a classe de intenção (performance, security, governance, correctness).",
        responses: {
          "200": { description: "Torneio concluído com veredito e hash canônico de evidência" }
        }
      }
    },
    "/api/vortex/llm/providers": {
      get: {
        tags: ["Multi-LLM Gateway"],
        summary: "Lista status de provedores LLM suportados",
        description: "Verifica conectividade e disponibilidade de Gemini, OpenAI, Ollama, LM Studio e LlamaCpp.",
        responses: {
          "200": { description: "Status dos provedores de LLM" }
        }
      }
    },
    "/api/vortex/llm/probe": {
      post: {
        tags: ["Multi-LLM Gateway"],
        summary: "Sonda conectividade de um provedor LLM",
        description: "Executa ping/probe em um host de LLM local ou remoto.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  provider: { type: "string", enum: ["gemini", "openai", "ollama", "lmstudio", "llamacpp", "custom"], example: "gemini" },
                  endpoint: { type: "string", example: "https://generativelanguage.googleapis.com" }
                },
                required: ["provider"]
              }
            }
          }
        },
        responses: {
          "200": { description: "Resultado da sondagem" }
        }
      }
    },
    "/api/vortex/llm/generate": {
      post: {
        tags: ["Multi-LLM Gateway"],
        summary: "Geração de texto governada com prova criptográfica",
        description: "Executa inferência com modelo LLM vinculando prompt, hiperparâmetros e saída a uma prova Ed25519.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  prompt: { type: "string", example: "Resuma a tese do Vortex VUA." },
                  model: { type: "string", example: "gemini-2.5-flash" },
                  provider: { type: "string", enum: ["gemini", "openai", "ollama", "lmstudio", "llamacpp"], example: "gemini" },
                  max_tokens: { type: "number", default: 512 },
                  temperature: { type: "number", default: 0.2 },
                  systemInstruction: { type: "string", example: "Você é o assistente de governança do VUA." }
                },
                required: ["prompt"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Texto gerado acompanhado de prova de execução",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    proof: { $ref: "#/components/schemas/ExecutionProof" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/vua/adapters": {
      get: {
        tags: ["Universal Adapters"],
        summary: "Lista adaptadores universais VUA registrados",
        description: "Retorna todos os 4 adaptadores universais (Linux Host, Android/ADB, Windows/PowerShell, GitHub) com capacidades e ações suportadas.",
        responses: {
          "200": {
            description: "Lista de adaptadores registrados",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    adapters: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "github" },
                          name: { type: "string", example: "GitHub Universal Adapter" },
                          environment: { type: "string", example: "Cloud VCS" },
                          version: { type: "string", example: "1.2.0" },
                          status: { type: "string", example: "ready" },
                          capabilities: { type: "array", items: { type: "string" } },
                          supportedActions: { type: "array", items: { type: "object" } }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/vua/adapters/{id}/probe": {
      post: {
        tags: ["Universal Adapters"],
        summary: "Sonda saúde de um adaptador específico",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Identificador do adaptador (github, linux, android, windows)",
            schema: { type: "string", enum: ["github", "linux", "android", "windows"] }
          }
        ],
        responses: {
          "200": { description: "Status de prontidão do adaptador" }
        }
      }
    },
    "/api/vua/adapters/{id}/invoke": {
      post: {
        tags: ["Universal Adapters"],
        summary: "Invoca ação governada em um adaptador de plataforma",
        description: "Executa uma ação normatizada em qualquer dos adaptadores VUA (ex: `inspect_repo`, `exec_command`, `adb_shell`, `powershell_exec`, `write_branch_commit`, `create_pr_written`, `merge_pr`).",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["github", "linux", "android", "windows"] }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  action: { type: "string", example: "inspect_repo" },
                  target: { type: "object", example: { owner: "vortex-foundation", repo: "vua-connector" } },
                  parameters: { type: "object" }
                },
                required: ["action"]
              }
            }
          }
        },
        responses: {
          "200": { description: "Ação executada com log de auditoria e dados" }
        }
      }
    },
    "/api/vua/conformance": {
      post: {
        tags: ["Universal Adapters"],
        summary: "Executa testes de conformidade de adaptadores",
        description: "Valida as garantias de isolamento de sandbox, cgroups, SELinux, ConstrainedLanguage e assinaturas git de todos os adaptadores.",
        responses: {
          "200": { description: "Relatório de conformidade dos adaptadores" }
        }
      }
    },
    "/api/github/connect": {
      post: {
        tags: ["GitHub Connector (Git Full)"],
        summary: "Conecta ao GitHub com PAT ou ativa modo Sandbox Demo",
        description: "Valida o Personal Access Token com a API do GitHub, descobre escopos e armazena a sessão governada de forma efêmera. Se `demo: true`, ativa os repositórios sandbox da Fundação sem token.",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  token: { type: "string", description: "Personal Access Token do GitHub (ghp_...)" },
                  demo: { type: "boolean", default: false, description: "Ativa modo sandbox da Fundação sem token" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Autenticação bem-sucedida" },
          "401": { description: "Token inválido ou expirado" }
        }
      }
    },
    "/api/github/disconnect": {
      post: {
        tags: ["GitHub Connector (Git Full)"],
        summary: "Desconecta e revoga o token local do GitHub",
        description: "Limpa a sessão de autenticação ativa e remove referências a credenciais em memória.",
        responses: {
          "200": { description: "Desconectado com sucesso" }
        }
      }
    },
    "/api/github/status": {
      get: {
        tags: ["GitHub Connector (Git Full)"],
        summary: "Obtém status da conexão e usuário ativo do GitHub",
        description: "Retorna o usuário autenticado, escopos de token (repo, workflow, etc.), limites de taxa de API e o repositório alvo ativo.",
        responses: {
          "200": {
            description: "Status de conexão",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    authenticated: { type: "boolean" },
                    user: { type: "object" },
                    active_target: { type: "object" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/github/repos": {
      get: {
        tags: ["GitHub Connector (Git Full)"],
        summary: "Lista repositórios da conta GitHub ou Sandbox da Fundação",
        description: "Se autenticado com token ativo, consulta `api.github.com/user/repos`. Se em modo demo, retorna os repositórios oficiais governados da Fundação.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Lista de repositórios",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    repos: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "number" },
                          name: { type: "string" },
                          full_name: { type: "string" },
                          owner: { type: "string" },
                          private: { type: "boolean" },
                          description: { type: "string" },
                          default_branch: { type: "string" },
                          branches: { type: "array", items: { type: "string" } },
                          language: { type: "string" },
                          governed: { type: "boolean" },
                          branch_protection: { type: "boolean" },
                          ci_status: { type: "string" }
                        }
                      }
                    },
                    count: { type: "number" },
                    source: { type: "string", example: "live_github" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/github/active-target": {
      get: {
        tags: ["GitHub Connector (Git Full)"],
        summary: "Retorna o repositório e branch ativo para operações Git",
        responses: {
          "200": { description: "Alvo ativo" }
        }
      },
      post: {
        tags: ["GitHub Connector (Git Full)"],
        summary: "Define repositório e branch ativo para operações agênticas",
        description: "Configura qual repositório e branch receberão commits, propostas de PR e disparos de CI.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  owner: { type: "string", example: "vortex-foundation" },
                  repo: { type: "string", example: "vua-connector" },
                  branch: { type: "string", example: "main" },
                  commit_sha: { type: "string", example: "856920785b8392b036211cc851e1f6467961ff52" }
                },
                required: ["owner", "repo"]
              }
            }
          }
        },
        responses: {
          "200": { description: "Alvo configurado com sucesso" }
        }
      }
    },
    "/api/github/action": {
      post: {
        tags: ["GitHub Connector (Git Full)"],
        summary: "Executa operações Git governadas (Full Capability)",
        description: `Executa o ciclo completo de gerenciamento VCS no repositório ativo com garantias criptográficas Ed25519:
- **inspect_repo**: Inspeciona regras de branch protection, Code Owners e licenças.
- **verify_commit**: Valida assinatura criptográfica e árvore Git via SHA-256.
- **propose_pr**: Produz patch não-destrutivo com hash canônico RFC 8785 (Dry-Run).
- **inspect_workflows**: Audita workflows do GitHub Actions e conformidade GOS3.
- **check_ci_run**: Consulta runs do GitHub Actions para um commit com regra estrita de evidência.
- **verify_mergeability**: Avalia portões de proteção e a regra de ouro do VUA.
- **create_pr_written**: Cria e escreve Pull Request com descrição estruturada e checklist GOS3.
- **write_branch_commit**: Grava commit assinado com chave Ed25519 diretamente em branch de desenvolvimento.
- **merge_pr**: Executa o merge seguro após validação da regra de ouro: **CI 100% PASS → mergeability OK → merge**.`,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  action: {
                    type: "string",
                    enum: [
                      "inspect_repo",
                      "verify_commit",
                      "propose_pr",
                      "inspect_workflows",
                      "check_ci_run",
                      "verify_mergeability",
                      "create_pr_written",
                      "write_branch_commit",
                      "merge_pr"
                    ],
                    example: "create_pr_written"
                  },
                  payload: {
                    type: "object",
                    description: "Parâmetros específicos da ação (title, branch, file_path, content, message, pull_number, merge_method)",
                    properties: {
                      title: { type: "string", example: "feat: add VUA universal adapter bindings" },
                      base: { type: "string", example: "main" },
                      head: { type: "string", example: "feature/vua-connectors" },
                      body: { type: "string", example: "## VUA Pull Request..." },
                      branch: { type: "string", example: "feature/vua-connectors" },
                      file_path: { type: "string", example: "src/governance.json" },
                      content: { type: "string", example: '{"status": "ok"}' },
                      message: { type: "string", example: "feat: apply normative patch" },
                      pull_number: { type: "number", example: 42 },
                      merge_method: { type: "string", enum: ["squash", "merge", "rebase"], example: "squash" },
                      commit_title: { type: "string", example: "Merge pull request #42" }
                    }
                  }
                },
                required: ["action"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Ação Git executada com atestação e registro em auditLog",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "object" },
                    auditLog: { type: "array", items: { type: "string" } }
                  }
                }
              }
            }
          },
          "400": { description: "Ação desconhecida ou parâmetros ausentes" },
          "500": { description: "Erro interno durante execução da ação" }
        }
      }
    },
    "/api/auth/firebase/status": {
      get: {
        tags: ["Firebase Auth & Cloud Ledger"],
        summary: "Status da Integração Firebase Auth no Swagger",
        description: "Retorna a configuração do projeto Firebase Auth (`gen-lang-client-0100483792`), banco Firestore associado e instruções para autorização via Bearer Token.",
        responses: {
          "200": {
            description: "Status do Firebase Auth e parâmetros do Swagger",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    firebase_auth_enabled: { type: "boolean", example: true },
                    project_id: { type: "string", example: "gen-lang-client-0100483792" },
                    firestore_database_id: { type: "string", example: "ai-studio-vua-af455402-116e-49f5-ae4d-f61823d79733" },
                    firestore_region: { type: "string", example: "us-west2" },
                    auth_domain: { type: "string", example: "gen-lang-client-0100483792.firebaseapp.com" },
                    swagger_security_scheme: { type: "string", example: "FirebaseAuth (HTTP Bearer / Firebase ID Token JWT)" },
                    token_issuer: { type: "string", example: "https://securetoken.google.com/gen-lang-client-0100483792" },
                    supported_algorithms: { type: "array", items: { type: "string" }, example: ["RS256"] }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/firebase/verify": {
      post: {
        tags: ["Firebase Auth & Cloud Ledger"],
        summary: "Validar Firebase ID Token (JWT) e Claims de Operador",
        description: "Valida o token JWT emitido pelo Firebase Auth, decodifica o payload com segurança (claims `iss`, `aud`, `sub`, `exp`, `email`) e resolve o papel ABAC (`admin` ou `operator`).",
        security: [
          { FirebaseAuth: [] },
          { BearerAuth: [] }
        ],
        requestBody: {
          description: "Opcional se enviado via header 'Authorization: Bearer <ID_TOKEN>'.",
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  idToken: { type: "string", description: "ID Token JWT do Firebase Auth" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Token validado com sucesso e perfil de operador retornado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    valid: { type: "boolean", example: true },
                    role: { type: "string", enum: ["admin", "operator", "user"], example: "admin" },
                    user: {
                      type: "object",
                      properties: {
                        uid: { type: "string" },
                        email: { type: "string" },
                        email_verified: { type: "boolean" },
                        role: { type: "string" },
                        project_id: { type: "string" },
                        expires_at: { type: "string", format: "date-time" },
                        auth_time: { type: "number" }
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            description: "Token inválido, expirado ou com audiência/emissor divergentes"
          }
        }
      }
    },
    "/api/auth/firebase/me": {
      get: {
        tags: ["Firebase Auth & Cloud Ledger"],
        summary: "Perfil do Operador Autenticado (Protegido por Bearer Token)",
        description: "Retorna a identidade do operador atualmente autenticado através do cabeçalho `Authorization: Bearer <FIREBASE_ID_TOKEN>`.",
        security: [
          { FirebaseAuth: [] },
          { BearerAuth: [] }
        ],
        responses: {
          "200": {
            description: "Dados do operador autenticado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    authenticated: { type: "boolean", example: true },
                    uid: { type: "string" },
                    email: { type: "string" },
                    role: { type: "string", example: "admin" },
                    email_verified: { type: "boolean" },
                    claims: { type: "object" }
                  }
                }
              }
            }
          },
          "401": { description: "Cabeçalho de autorização ausente ou token inválido" }
        }
      }
    },
    "/api/auth/firebase/demo-token": {
      post: {
        tags: ["Firebase Auth & Cloud Ledger"],
        summary: "Consultar Política de Tokens e Acesso Restrito",
        description: "Informa a política de segurança de autenticação. Tokens de bypass anônimos são proibidos sob Zero-Trust; todo acesso exige autenticação prévia com credenciais válidas.",
        responses: {
          "403": {
            description: "Acesso direto a tokens anônimos desabilitado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    message: { type: "string" },
                    auth_required: { type: "boolean" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/firestore/proofs": {
      get: {
        tags: ["Firebase Auth & Cloud Ledger"],
        summary: "Listar Provas de Execução Governamentais no Firestore",
        description: "Recupera as últimas provas persistidas na coleção `/execution_proofs` com proteção ABAC e filtro de auditoria.",
        security: [
          { FirebaseAuth: [] },
          { BearerAuth: [] }
        ],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20 },
            description: "Quantidade máxima de provas a retornar"
          }
        ],
        responses: {
          "200": {
            description: "Lista de provas de execução persistidas",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    collection: { type: "string", example: "execution_proofs" },
                    database_id: { type: "string" },
                    count: { type: "integer" },
                    proofs: { type: "array", items: { $ref: "#/components/schemas/ExecutionProof" } }
                  }
                }
              }
            }
          },
          "401": { description: "Autenticação requerida" }
        }
      },
      post: {
        tags: ["Firebase Auth & Cloud Ledger"],
        summary: "Persistir Prova de Execução Governamental no Firestore",
        description: "Registra uma prova de execução validada com assinatura Ed25519 e digest canônico RFC 8785 no Cloud Firestore associando ao UID do operador autenticado.",
        security: [
          { FirebaseAuth: [] },
          { BearerAuth: [] }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ExecutionProof" }
            }
          }
        },
        responses: {
          "200": {
            description: "Prova registrada com sucesso",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    proof_id: { type: "string" },
                    firestore_path: { type: "string" },
                    timestamp: { type: "string", format: "date-time" }
                  }
                }
              }
            }
          },
          "400": { description: "Estrutura da prova inválida" },
          "401": { description: "Não autorizado" }
        }
      }
    }
  },
  security: [
    { FirebaseAuth: [] },
    { BearerAuth: [] }
  ],
  components: {
    securitySchemes: {
      FirebaseAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Firebase ID Token (JWT)",
        description: "Token JWT de Identidade emitido pelo Firebase Authentication. No Swagger, clique no botão 'Authorize' (cadeado) acima e insira o token ID do Firebase obtido após autenticação no Painel VUA."
      },
      FirebaseOAuth2: {
        type: "openIdConnect",
        openIdConnectUrl: "https://accounts.google.com/.well-known/openid-configuration",
        description: "Provedor OpenID Connect Google/Firebase do projeto gen-lang-client-0100483792."
      },
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT / PAT",
        description: "Token de autorização do Vortex ou Personal Access Token (PAT) do GitHub para acesso a recursos protegidos."
      }
    },
    schemas: {
      CryptographicIdentity: {
        type: "object",
        properties: {
          agent_id: { type: "string", example: "vua-agent-runtime-prod" },
          principal_id: { type: "string", example: "principal-vortex-gateway-001" },
          key_id: { type: "string", example: "key-vortex-root-primary" },
          algorithm: { type: "string", example: "Ed25519" },
          public_key: { type: "string" }
        }
      },
      ExecutionProof: {
        type: "object",
        properties: {
          proof_version: { type: "string", example: "1" },
          request_id: { type: "string" },
          execution_id: { type: "string" },
          runtime_id: { type: "string" },
          agent_id: { type: "string" },
          principal_id: { type: "string" },
          connector_id: { type: "string" },
          operation: { type: "string" },
          executed: { type: "boolean" },
          status: { type: "string" },
          input_hash: { type: "string", example: "sha256:d82e811c..." },
          output_hash: { type: "string", example: "sha256:9e821037..." },
          started_at: { type: "string", format: "date-time" },
          completed_at: { type: "string", format: "date-time" },
          duration_ms: { type: "number" },
          policy_id: { type: "string" },
          policy_version: { type: "string" },
          gos3_session_id: { type: "string" },
          sandbox_id: { type: "string" },
          identity: {
            type: "object",
            properties: {
              key_id: { type: "string" },
              algorithm: { type: "string", example: "Ed25519" }
            }
          },
          signature: { type: "string", description: "Assinatura Base64 Ed25519 do JCS canônico RFC 8785" },
          proof_hash: { type: "string" }
        }
      }
    }
  }
};
