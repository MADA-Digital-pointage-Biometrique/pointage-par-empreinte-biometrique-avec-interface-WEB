<?php

namespace App\Core;

use PDO;

abstract class Model
{
    protected static string $table;
    protected static string $primaryKey = 'id';

    public static function all(): array
    {
        $stmt = Database::connection()->query('SELECT * FROM ' . static::$table . ' ORDER BY id DESC');
        return $stmt->fetchAll();
    }

    public static function find(int $id): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM ' . static::$table . ' WHERE ' . static::$primaryKey . ' = ?'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function where(string $column, $value): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM ' . static::$table . ' WHERE ' . $column . ' = ?'
        );
        $stmt->execute([$value]);
        return $stmt->fetchAll();
    }

    public static function create(array $data): int
    {
        $columns = array_keys($data);
        $stmt = Database::connection()->prepare(
            'INSERT INTO ' . static::$table . ' (' . implode(', ', $columns) . ') VALUES (:' . implode(', :', $columns) . ')'
        );
        $stmt->execute($data);
        return (int) Database::connection()->lastInsertId();
    }

    public static function update(int $id, array $data): void
    {
        $set = implode(', ', array_map(fn($col) => "$col = :$col", array_keys($data)));
        $data[static::$primaryKey] = $id;
        $stmt = Database::connection()->prepare(
            'UPDATE ' . static::$table . ' SET ' . $set . ' WHERE ' . static::$primaryKey . ' = :' . static::$primaryKey
        );
        $stmt->execute($data);
    }

    public static function delete(int $id): void
    {
        $stmt = Database::connection()->prepare(
            'DELETE FROM ' . static::$table . ' WHERE ' . static::$primaryKey . ' = ?'
        );
        $stmt->execute([$id]);
    }

    public static function query(string $sql, array $params = []): array
    {
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }
}