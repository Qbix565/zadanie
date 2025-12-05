const fs = require("fs");
let liczby = fs.readFileSync("liczby.txt", "utf-8");
console.log(liczby);
liczby = liczby.split("\n");
let liczba = liczby[6];
console.log("");
console.log(liczba);
