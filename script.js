document.getElementById('notaForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const corte1 = parseFloat(document.getElementById('corte1').value);
    const corte2 = parseFloat(document.getElementById('corte2').value);
    const corte3 = parseFloat(document.getElementById('corte3').value);

    if (isNaN(corte1) || isNaN(corte2) || isNaN(corte3)) {
        document.getElementById('resultado').innerText = "Por favor, ingresa todas las notas correctamente.";
        return;
    }

    const porcentajeCortes = (corte1 + corte2 + corte3) * 0.2; // cada corte vale 20%
    const notaDeseada = 3.0; // nota mínima para aprobar
    const notaNecesaria = ((notaDeseada - porcentajeCortes) / 0.4).toFixed(2); // final vale 40%

    let mensaje = "";

    if (notaNecesaria <= 0) {
        mensaje = "¡Ya has aprobado con tus notas actuales!";
    } else if (notaNecesaria > 5) {
        mensaje = "Necesitas más de 5.0 en el examen final para aprobar. 😟";
    } else {
        mensaje = `Necesitas sacar al menos <strong>${notaNecesaria}</strong> en el examen final para aprobar.`;
    }

    document.getElementById('resultado').innerHTML = mensaje;
});
