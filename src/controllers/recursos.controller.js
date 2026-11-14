
const recursosController = {

    mostrarInicio: (req, res) => {
        res.render('recursos/index', {
            titulo: 'Recursos',
            descripcion: 'Consulta recursos y materiales de orientación profesional.'
        });
    }

};

module.exports = recursosController;
