#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""

@File    : file_repository.py
"""
from typing import Protocol, Optional

from app.domain.models.file import File


class FileRepository(Protocol):
    """文件模型数据仓库"""

    async def save(self, file: File) -> None:
        """新增或更新文件信息"""
        ...

    async def get_by_id(self, file_id: str) -> Optional[File]:
        """根据传递的文件id获取文件信息"""
        ...

    async def delete_by_id(self, file_id: str) -> None:
        """根据传递的文件id删除文件信息"""
        ...
