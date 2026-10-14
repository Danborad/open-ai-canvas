# KM 可美 Seedream 图片接口字段

## 协议身份

- 插件 ID：`km-kemei-seedream-image`。
- Provider ID：`km-kemei-seedream-image`。
- 能力：`image`。
- 默认 Base URL：`https://token.xinhankr.com`。
- 鉴权：`Authorization: Bearer <apiKey>`。
- 创建：`POST /v1/images/generations`。
- 生命周期：同步响应。

## 提交任务

请求体使用 JSON。`model` 与 `prompt` 为核心字段。参考图支持 URL 数组发送至 `image_urls`。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | 是 | 推荐 `doubao-seedream-5-0-pro-260628` 或 `doubao-seedream-5-0-260128`。 |
| `prompt` | string | 是 | 描述画面的提示词。 |
| `image_urls` | array | 否 | 参考图片 URL 数组。 |
| `size` | string | 否 | 分辨率/尺寸，如 `2K`、`1K`、`1.5K`、`3K`、`4K` 或具体尺寸。 |
| `n` | integer | 否 | 生成张数。Pro 模型必须为 1；Lite 与 4.x 模型支持 1~15。 |
| `watermark` | boolean | 否 | 是否添加水印，默认 `false`。 |
| `response_format` | string | 否 | 固定为 `url`。 |
| `background` | string | 否 | 仅 Pro 支持。`opaque` 或 `transparent`（透明背景）。 |
| `output_format` | string | 否 | 底图编码 `png` 或 `jpeg`。透明背景时需为 `png`。 |
| `layer_decomposition` | boolean | 否 | 仅 Pro 支持。图层拆分开关。 |
| `web_search` | boolean | 否 | 仅 5.0 lite 支持。联网搜索开关。 |

扩展字段命名空间为 `providerOptions.km-kemei-seedream-image`。

## 返回示例

```json
{
  "created": 1719441600,
  "data": [
    { "url": "https://example.com/output/a.png", "size": "2048x2048" }
  ]
}
```

<!-- YINGCE_MANIFEST_CONTRACT_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "yingce.plugin/v2",
  "id": "km-kemei-seedream-image",
  "name": "KM 可美 Seedream 图片",
  "version": "1.0.0",
  "author": "KM 可美 / 影策",
  "description": "KM 可美豆包 Seedream 图像生成协议插件，兼容 OpenAI 规范，支持文生图、组图、多图参考、透明背景与图层拆分。",
  "permissions": [
    "generation.run",
    "media.read"
  ],
  "configuration": {
    "fields": [
      {
        "name": "apiKey",
        "type": "secret",
        "label": "API Key",
        "required": true
      }
    ]
  },
  "contributes": {
    "providers": [
      {
        "id": "km-kemei-seedream-image",
        "label": "KM 可美 Seedream 图片",
        "capabilities": [
          "image"
        ],
        "scopes": [
          "admin.system-channel",
          "user.custom-channel",
          "canvas",
          "creation",
          "agent"
        ],
        "baseUrl": "https://token.xinhankr.com",
        "requiresPublicMediaUrls": false,
        "auth": {
          "type": "bearer",
          "field": "apiKey"
        },
        "imageParameters": [
          {
            "name": "size",
            "label": "画幅 / 尺寸",
            "type": "string",
            "binding": "aspectRatio",
            "encoding": "pixels",
            "pricing": true
          },
          {
            "name": "imageResolution",
            "label": "分辨率",
            "type": "string",
            "binding": "resolution",
            "values": [
              "1k",
              "1.5k",
              "2k"
            ],
            "default": "2k",
            "enabled": true,
            "pricing": true
          },
          {
            "name": "count",
            "label": "生成数量",
            "type": "integer",
            "binding": "imageCount",
            "min": 1,
            "max": 1,
            "step": 1,
            "default": 1
          },
          {
            "name": "transparentBackground",
            "label": "透明背景",
            "type": "boolean",
            "binding": "transparentBackground",
            "default": false,
            "enabled": false
          }
        ],
        "parameters": [
          {
            "name": "model",
            "type": "string",
            "required": true,
            "mapping": "model",
            "description": "图片生成模型名称，如 doubao-seedream-5-0-pro-260628。"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "prompt",
            "description": "描述画面内容的提示词。"
          },
          {
            "name": "images",
            "type": "media[]",
            "required": false,
            "mapping": "image_urls",
            "description": "参考图片链接数组。"
          },
          {
            "name": "imageCount",
            "type": "integer",
            "required": false,
            "mapping": "n",
            "description": "生成张数（Pro 必须为 1，Lite/4.x 可设 1-15）。"
          },
          {
            "name": "aspectRatio",
            "type": "string",
            "required": false,
            "mapping": "size",
            "description": "画幅尺寸，如 2K、1K、4K 或 2048x2048。"
          },
          {
            "name": "resolution",
            "type": "string",
            "required": false,
            "mapping": "size",
            "description": "分辨率档位，如 2K、1K、4K。"
          },
          {
            "name": "quality",
            "type": "string",
            "required": false,
            "mapping": "quality",
            "description": "画质档位。"
          },
          {
            "name": "watermark",
            "type": "boolean",
            "required": false,
            "mapping": "watermark",
            "description": "是否添加水印。"
          },
          {
            "name": "providerOptions",
            "type": "object",
            "required": false,
            "mapping": "provider-specific fields",
            "description": "KM 可美协议扩展字段。"
          }
        ],
        "create": {
          "method": "POST",
          "path": "/v1/images/generations",
          "contentType": "application/json",
          "body": {
            "model": {
              "$coalesce": [
                {
                  "$ref": "request.model"
                },
                "doubao-seedream-5-0-pro-260628"
              ]
            },
            "prompt": {
              "$ref": "request.prompt"
            },
            "response_format": "url",
            "size": {
              "$omitEmpty": {
                "$switch": {
                  "cases": [
                    {
                      "when": {
                        "$eq": [
                          {
                            "$ref": "request.aspectRatio"
                          },
                          "auto"
                        ]
                      },
                      "then": "2K"
                    },
                    {
                      "when": {
                        "$eq": [
                          {
                            "$ref": "request.aspectRatio"
                          },
                          "1:1"
                        ]
                      },
                      "then": "2048x2048"
                    },
                    {
                      "when": {
                        "$eq": [
                          {
                            "$ref": "request.aspectRatio"
                          },
                          "4:3"
                        ]
                      },
                      "then": "2304x1728"
                    },
                    {
                      "when": {
                        "$eq": [
                          {
                            "$ref": "request.aspectRatio"
                          },
                          "3:4"
                        ]
                      },
                      "then": "1728x2304"
                    },
                    {
                      "when": {
                        "$eq": [
                          {
                            "$ref": "request.aspectRatio"
                          },
                          "16:9"
                        ]
                      },
                      "then": "2560x1440"
                    },
                    {
                      "when": {
                        "$eq": [
                          {
                            "$ref": "request.aspectRatio"
                          },
                          "9:16"
                        ]
                      },
                      "then": "1440x2560"
                    },
                    {
                      "when": {
                        "$eq": [
                          {
                            "$ref": "request.aspectRatio"
                          },
                          "3:2"
                        ]
                      },
                      "then": "2496x1664"
                    },
                    {
                      "when": {
                        "$eq": [
                          {
                            "$ref": "request.aspectRatio"
                          },
                          "2:3"
                        ]
                      },
                      "then": "1664x2496"
                    },
                    {
                      "when": {
                        "$eq": [
                          {
                            "$ref": "request.aspectRatio"
                          },
                          "21:9"
                        ]
                      },
                      "then": "3024x1296"
                    },
                    {
                      "when": {
                        "$or": [
                          {
                            "$eq": [
                              {
                                "$ref": "request.aspectRatio"
                              },
                              "1.5k"
                            ]
                          },
                          {
                            "$eq": [
                              {
                                "$ref": "request.aspectRatio"
                              },
                              "1.5K"
                            ]
                          }
                        ]
                      },
                      "then": "1.5K"
                    },
                    {
                      "when": {
                        "$and": [
                          {
                            "$or": [
                              {
                                "$contains": [
                                  {
                                    "$lower": {
                                      "$ref": "request.model"
                                    }
                                  },
                                  "pro"
                                ]
                              },
                              {
                                "$contains": [
                                  {
                                    "$lower": {
                                      "$ref": "request.model"
                                    }
                                  },
                                  "flash"
                                ]
                              }
                            ]
                          },
                          {
                            "$or": [
                              {
                                "$eq": [
                                  {
                                    "$ref": "request.aspectRatio"
                                  },
                                  "4k"
                                ]
                              },
                              {
                                "$eq": [
                                  {
                                    "$ref": "request.aspectRatio"
                                  },
                                  "4K"
                                ]
                              },
                              {
                                "$eq": [
                                  {
                                    "$ref": "request.aspectRatio"
                                  },
                                  "3840x2160"
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      "then": "2560x1440"
                    },
                    {
                      "when": {
                        "$and": [
                          {
                            "$or": [
                              {
                                "$contains": [
                                  {
                                    "$lower": {
                                      "$ref": "request.model"
                                    }
                                  },
                                  "pro"
                                ]
                              },
                              {
                                "$contains": [
                                  {
                                    "$lower": {
                                      "$ref": "request.model"
                                    }
                                  },
                                  "flash"
                                ]
                              }
                            ]
                          },
                          {
                            "$eq": [
                              {
                                "$ref": "request.aspectRatio"
                              },
                              "2160x3840"
                            ]
                          }
                        ]
                      },
                      "then": "1440x2560"
                    },
                    {
                      "when": {
                        "$and": [
                          {
                            "$or": [
                              {
                                "$contains": [
                                  {
                                    "$lower": {
                                      "$ref": "request.model"
                                    }
                                  },
                                  "pro"
                                ]
                              },
                              {
                                "$contains": [
                                  {
                                    "$lower": {
                                      "$ref": "request.model"
                                    }
                                  },
                                  "flash"
                                ]
                              }
                            ]
                          },
                          {
                            "$or": [
                              {
                                "$eq": [
                                  {
                                    "$ref": "request.aspectRatio"
                                  },
                                  "2880x2880"
                                ]
                              },
                              {
                                "$eq": [
                                  {
                                    "$ref": "request.aspectRatio"
                                  },
                                  "4096x4096"
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      "then": "2048x2048"
                    }
                  ],
                  "default": {
                    "$coalesce": [
                      {
                        "$if": {
                          "condition": {
                            "$or": [
                              {
                                "$eq": [
                                  {
                                    "$ref": "request.aspectRatio"
                                  },
                                  "720"
                                ]
                              },
                              {
                                "$eq": [
                                  {
                                    "$ref": "request.aspectRatio"
                                  },
                                  "720p"
                                ]
                              }
                            ]
                          },
                          "then": "2K",
                          "else": {
                            "$ref": "request.aspectRatio"
                          }
                        }
                      },
                      "2K"
                    ]
                  }
                }
              }
            },
            "n": {
              "$omitEmpty": {
                "$if": {
                  "condition": {
                    "$or": [
                      {
                        "$contains": [
                          {
                            "$lower": {
                              "$ref": "request.model"
                            }
                          },
                          "pro"
                        ]
                      },
                      {
                        "$contains": [
                          {
                            "$lower": {
                              "$ref": "request.model"
                            }
                          },
                          "flash"
                        ]
                      }
                    ]
                  },
                  "then": null,
                  "else": {
                    "$if": {
                      "condition": {
                        "$gt": [
                          {
                            "$ref": "request.imageCount"
                          },
                          1
                        ]
                      },
                      "then": {
                        "$ref": "request.imageCount"
                      },
                      "else": null
                    }
                  }
                }
              }
            },
            "watermark": {
              "$coalesce": [
                {
                  "$ref": "request.watermark"
                },
                false
              ]
            },
            "image_urls": {
              "$omitEmpty": {
                "$map": {
                  "from": {
                    "$sortByOrder": {
                      "$ref": "request.images"
                    }
                  },
                  "as": "media",
                  "in": {
                    "$ref": "media.value"
                  }
                }
              }
            },
            "background": {
              "$omitEmpty": {
                "$coalesce": [
                  {
                    "$ref": "request.providerOptions.km-kemei-seedream-image.background"
                  },
                  {
                    "$ref": "request.providerOptions.km-seedream-image.background"
                  }
                ]
              }
            },
            "output_format": {
              "$omitEmpty": {
                "$coalesce": [
                  {
                    "$ref": "request.providerOptions.km-kemei-seedream-image.output_format"
                  },
                  {
                    "$ref": "request.providerOptions.km-seedream-image.output_format"
                  },
                  {
                    "$if": {
                      "condition": {
                        "$eq": [
                          {
                            "$ref": "request.providerOptions.km-kemei-seedream-image.background"
                          },
                          "transparent"
                        ]
                      },
                      "then": "png",
                      "else": null
                    }
                  }
                ]
              }
            },
            "layer_decomposition": {
              "$omitEmpty": {
                "$coalesce": [
                  {
                    "$ref": "request.providerOptions.km-kemei-seedream-image.layer_decomposition"
                  },
                  {
                    "$ref": "request.providerOptions.km-seedream-image.layer_decomposition"
                  }
                ]
              }
            },
            "web_search": {
              "$omitEmpty": {
                "$coalesce": [
                  {
                    "$ref": "request.providerOptions.km-kemei-seedream-image.web_search"
                  },
                  {
                    "$ref": "request.providerOptions.km-seedream-image.web_search"
                  }
                ]
              }
            },
            "seed": {
              "$omitEmpty": {
                "$coalesce": [
                  {
                    "$ref": "request.providerOptions.km-kemei-seedream-image.seed"
                  },
                  {
                    "$ref": "request.providerOptions.km-seedream-image.seed"
                  }
                ]
              }
            }
          }
        },
        "response": {
          "images": {
            "$coalesce": [
              {
                "$map": {
                  "from": {
                    "$ref": "response.data"
                  },
                  "as": "item",
                  "in": {
                    "$coalesce": [
                      {
                        "$ref": "item.url"
                      },
                      {
                        "$ref": "item.b64_json"
                      }
                    ]
                  }
                }
              },
              {
                "$ref": "response.data.url"
              },
              {
                "$ref": "response.url"
              }
            ]
          },
          "errorPaths": [
            "error.code",
            "data.error.code"
          ]
        }
      }
    ]
  },
  "documentation": "<当前插件的完整 documentation，由 README.md 与 docs/interface.md 拼接而成；为避免 JSON 递归，此处不重复展开正文。>"
}
```
<!-- YINGCE_MANIFEST_CONTRACT_END -->
